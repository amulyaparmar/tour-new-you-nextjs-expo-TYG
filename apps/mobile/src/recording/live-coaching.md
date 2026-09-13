# Live coaching

Live coaching uses one event-driven flow:

1. The mobile controller waits for finalized transcript turns.
2. It sends new turns, recent context, bounded coaching state, and recent advice to the session coaching endpoint.
3. The model updates that state and returns `observe`, `nudge`, or `intervene` with two practical options.
4. The controller suppresses duplicate or superseded advice and keeps displayed suggestions available in Tour AI chat.

The feature does not own microphone capture or transcription. Transient request failures are silent and retried with backoff.

The server defaults to the direct Gemini API. Configure it with `GEMINI_API_KEY`, `LIVE_COACHING_PROVIDER=gemini`, and optionally `LIVE_COACHING_MODEL`. `LIVE_COACHING_PROVIDER=bedrock` uses the existing Bedrock model adapter instead.
