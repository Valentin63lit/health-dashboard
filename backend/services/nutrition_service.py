"""
Nutrition service — handles MacroFactor import and manual text input.
Upserts nutrition data to Google Sheets Daily Log (columns B–I only).
"""

from typing import Optional

from backend.clients.sheets_client import SheetsClient
from backend.parsers.macrofactor_parser import MacroFactorParser
from backend.utils.logger import get_logger

log = get_logger("NUTRITION")


class NutritionService:
    """Handles nutrition data import from MacroFactor and manual input."""

    def __init__(self, sheets_client: SheetsClient):
        self.sheets = sheets_client

    def import_macrofactor_file(self, file_path: str) -> dict:
        """
        Parse a MacroFactor .xlsx export and upsert the data into Google Sheets.

        Args:
            file_path: Path to the .xlsx file

        Returns:
            {
                "success": bool,
                "format": str,
                "message": str,
                "days_imported": int,
                "nutrition_count": int,
                "weight_count": int,
                "goals_updated": bool,
            }
        """
        log.info("import_file", f"START — Processing MacroFactor file: {file_path}")

        result = {
            "success": False,
            "format": "",
            "message": "",
            "days_imported": 0,
            "nutrition_count": 0,
            "weight_count": 0,
            "goals_updated": False,
        }

        try:
            parser = MacroFactorParser(file_path)
            parser.load()
            parsed = parser.parse()
            result["format"] = parsed["format"]

            if parsed["format"] == "program_settings":
                # Goals update
                goals_data = parsed.get("goals_data", [])
                if goals_data:
                    self.sheets.update_goals(goals_data)
                    result["goals_updated"] = True
                    result["success"] = True
                    # Build a nice summary
                    sample = goals_data[0]
                    result["message"] = (
                        f"🎯 Updated macro targets for {len(goals_data)} days.\n"
                        f"Sample (Mon): {sample.get('Target_Calories', '?')}cal | "
                        f"{sample.get('Target_Protein_g', '?')}P "
                        f"{sample.get('Target_Carbs_g', '?')}C "
                        f"{sample.get('Target_Fats_g', '?')}F"
                    )
                else:
                    result["message"] = "⚠️ No valid goal data found in Program Settings file."
            else:
                # Daily data import (Format A or B)
                daily_data = parsed.get("daily_data", {})
                if not daily_data:
                    result["message"] = "⚠️ No valid daily data found in the file."
                    log.warning("import_file", result["message"])
                    return result

                # Count nutrition and weight entries before upserting
                nutrition_count = sum(
                    1 for d in daily_data.values()
                    if d.get("Calories") or d.get("Protein_g")
                )
                weight_count = sum(
                    1 for d in daily_data.values()
                    if d.get("Weight_kg")
                )

                # Upsert to Google Sheets
                rows = [(date_str, data) for date_str, data in sorted(daily_data.items())]
                success_count = self.sheets.upsert_daily_rows_batch(rows, source="nutrition")

                result["success"] = True
                result["days_imported"] = success_count
                result["nutrition_count"] = nutrition_count
                result["weight_count"] = weight_count

                dates = sorted(daily_data.keys())
                date_range = f"{dates[0]}–{dates[-1]}" if dates else "?"
                result["message"] = (
                    f"✅ Imported {success_count} days of data ({date_range}).\n"
                    f"Updated: {nutrition_count} nutrition entries, {weight_count} weight entries."
                )

            parser.close()
            log.info("import_file", f"SUCCESS — {result['message']}")

        except ValueError as e:
            result["message"] = f"❌ Could not parse file: {e}"
            log.error("import_file", result["message"])
        except Exception as e:
            result["message"] = f"❌ Unexpected error: {type(e).__name__}: {e}"
            log.error("import_file", result["message"])

        return result

    def import_manual_entry(self, date_str: str, weight: Optional[float] = None,
                            protein: Optional[float] = None, carbs: Optional[float] = None,
                            fats: Optional[float] = None, calories: Optional[int] = None) -> dict:
        """
        Process a manual nutrition entry from Telegram text input.

        Args:
            date_str: Date in YYYY-MM-DD format
            weight, protein, carbs, fats, calories: Optional nutrition values

        Returns:
            {"success": bool, "message": str, "warnings": list}
        """
        log.info("manual_entry", f"START — Manual entry for {date_str}")

        result = {"success": False, "message": "", "warnings": []}

        # Validate inputs
        if weight is not None:
            if not (40 <= weight <= 200):
                result["warnings"].append(f"⚠️ Weight {weight}kg seems unusual (expected 40-200)")
        if calories is not None:
            if calories > 5000:
                result["warnings"].append(f"⚠️ Calories {calories} seems high (>5000)")

        # Build data dict (only non-None values)
        data = {}
        if weight is not None:
            data["Weight_kg"] = round(weight, 1)
        if protein is not None:
            data["Protein_g"] = round(protein, 1)
        if carbs is not None:
            data["Carbs_g"] = round(carbs, 1)
        if fats is not None:
            data["Fats_g"] = round(fats, 1)
        if calories is not None:
            data["Calories"] = int(calories)

        if not data:
            result["message"] = "⚠️ No values provided to update."
            return result

        try:
            self.sheets.upsert_daily_row(date_str, data, source="nutrition")
            result["success"] = True

            # Build confirmation message
            parts = []
            if weight is not None:
                parts.append(f"{weight}kg")
            if protein is not None:
                parts.append(f"{protein:.0f}P")
            if carbs is not None:
                parts.append(f"{carbs:.0f}C")
            if fats is not None:
                parts.append(f"{fats:.0f}F")
            if calories is not None:
                parts.append(f"{calories}cal")

            # Format the date nicely
            from datetime import datetime
            dt = datetime.strptime(date_str, "%Y-%m-%d")
            nice_date = dt.strftime("%b %-d")

            result["message"] = f"✅ {nice_date} — {' | '.join(parts)}"
            log.info("manual_entry", f"SUCCESS — {result['message']}")

        except Exception as e:
            result["message"] = f"❌ Failed to save: {type(e).__name__}: {e}"
            log.error("manual_entry", result["message"])

        return result

    @staticmethod
    def parse_manual_text(text: str) -> dict:
        """
        Parse manual text input format:
        YYYY-MM-DD weight protein carbs fats calories
        Use '-' to skip a field.

        Returns:
            {"date": str, "weight": float|None, "protein": float|None,
             "carbs": float|None, "fats": float|None, "calories": int|None}
            or raises ValueError if format is invalid.
        """
        parts = text.strip().split()
        if len(parts) < 2:
            raise ValueError(
                "Format: YYYY-MM-DD weight protein carbs fats calories\n"
                "Use '-' to skip a field. Example: 2026-02-09 85.2 180 200 70 2100"
            )

        date_str = parts[0]
        # Validate date format
        try:
            from datetime import datetime
            datetime.strptime(date_str, "%Y-%m-%d")
        except ValueError:
            raise ValueError(f"Invalid date format: '{date_str}'. Use YYYY-MM-DD.")

        def parse_val(val, is_int=False):
            if val == "-":
                return None
            try:
                return int(float(val)) if is_int else float(val)
            except ValueError:
                return None

        result = {"date": date_str}
        fields = ["weight", "protein", "carbs", "fats", "calories"]
        is_int = [False, False, False, False, True]

        for i, field in enumerate(fields):
            if i + 1 < len(parts):
                result[field] = parse_val(parts[i + 1], is_int=is_int[i])
            else:
                result[field] = None

        return result
