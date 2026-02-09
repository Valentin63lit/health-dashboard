"""
Claude API client — generates AI-powered health summaries using the Anthropic SDK.

Uses the prompt template from PROJECT_SCOPE.md Section 6.
Retries once on failure before raising.
"""

import json

from anthropic import Anthropic

from backend.config import ANTHROPIC_API_KEY, CLAUDE_MODEL
from backend.utils.logger import get_logger

log = get_logger("CLAUDE")

PROMPT_TEMPLATE = """You are a concise health analyst. Analyze the following health data and provide:

1. **This Week (7-day):** Key highlights — what went well, what needs attention. Compare actuals vs targets.
2. **Monthly Trend (30-day):** Are things improving, declining, or stable? Focus on weight trend, sleep quality, and nutrition compliance.
3. **Correlations:** Any patterns you notice (e.g., sleep quality vs nutrition, HRV vs activity).
4. **Action Items:** 2-3 specific, actionable recommendations for next week.

Keep it under 300 words. Be direct, no fluff. Use bullet points sparingly — prefer short sentences.

Data (last 7 days):
{data}

Monthly data (last 30 days):
{month_data}

Targets:
{targets}

Previous week summaries:
{prev_weeks}"""


class ClaudeClient:
    """Anthropic Claude API client for health summaries."""

    def __init__(self):
        if not ANTHROPIC_API_KEY:
            raise ValueError("ANTHROPIC_API_KEY not set in environment")
        self.client = Anthropic(api_key=ANTHROPIC_API_KEY)
        self.model = CLAUDE_MODEL

    def generate_weekly_summary(
        self,
        daily_data: list[dict],
        goals: list[dict],
        prev_week_summaries: list[dict],
        month_data: list[dict],
    ) -> str:
        """
        Generate a weekly health summary using Claude.

        Args:
            daily_data: Last 7 days of Daily Log data.
            goals: Current macro/calorie targets from Goals tab.
            prev_week_summaries: Previous 4 weeks of Weekly Summary rows.
            month_data: Last 30 days of Daily Log data.

        Returns:
            Summary text string, or empty string on failure.

        Raises:
            Exception: After 2 failed attempts.
        """
        log.info("generate", "START — Calling Claude API for weekly summary")

        prompt = PROMPT_TEMPLATE.format(
            data=json.dumps(daily_data, indent=2, default=str),
            month_data=json.dumps(month_data, indent=2, default=str),
            targets=json.dumps(goals, indent=2, default=str),
            prev_weeks=json.dumps(prev_week_summaries, indent=2, default=str),
        )

        last_error = None
        for attempt in range(1, 3):  # 2 attempts max
            try:
                message = self.client.messages.create(
                    model=self.model,
                    max_tokens=1024,
                    messages=[
                        {"role": "user", "content": prompt}
                    ],
                )

                summary = message.content[0].text
                log.info(
                    "generate",
                    f"SUCCESS — Generated {len(summary)} chars "
                    f"(tokens: {message.usage.input_tokens} in, {message.usage.output_tokens} out)"
                )
                return summary

            except Exception as e:
                last_error = e
                log.error("generate", f"Attempt {attempt}/2 failed: {type(e).__name__}: {e}")
                if attempt < 2:
                    import time
                    time.sleep(5)  # Brief pause before retry

        # Both attempts failed
        raise RuntimeError(f"Claude API failed after 2 attempts: {last_error}")
