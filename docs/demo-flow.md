# Heatline — two-minute judges’ demo

Three moments: **hear Anwar, watch Omar test a plan, compare the shift**.

[Open the live demo](https://heatline-plum.vercel.app) · [Pitch script](pitch-script.md) · [Google Slides](https://docs.google.com/presentation/d/1U0cnRU4kcdr1z3TvDzAg8BzZWnwEI871LIf-HcL61D0/edit)

## Before presenting

- Use a desktop or laptop with a browser window at least 1024 pixels wide. Test the venue’s sound and connection.
- Confirm **Assistant connected**, a model attribution on the guidance, and a working **Listen** button.
- Use **Explore** under **The afternoon pour** for direct control. Story mode adds narrative pauses.
- Keep a second tab with a completed plan and comparison. Identify it as a prepared result if you use it.
- Rehearse once with the actual display and speakers. Model wording, plans and response times vary.

## Live sequence

| Time | Action | Presenter cue |
| --- | --- | --- |
| 0:00–0:15 | Show the animated landing. Choose **Explore → The afternoon pour → Deck**. Briefly collapse the side panels to reveal the 3D site, then reopen them. | “This is the site behind the warning.” |
| 0:15–0:40 | Select **Anwar**, show his Bengali guidance and press **Listen**. Point to Noor’s crew-level brief while speech prepares. | “A warning only helps if the person understands it. This voice is AI-generated.” |
| 0:40–1:15 | At **15:10**, playback pauses for the decision. Press **Ask Omar** with the default concrete-truck question. Point to the conditions and planning tool calls as they appear. | “He checks conditions and tests a proposed plan against the rules.” |
| 1:15–1:40 | Show the policy result **and the independent NIOSH exposure screen**. If a plan was refused and revised, point to that trace. | “Passing the demonstration policy doesn’t certify safety. The remaining exposure stays visible.” |
| 1:40–2:00 | For an accepted plan, click **Run this simulated plan**, then **Compare**. Highlight high-strain worker-minutes, exposure-screen findings and rest time. | “Same weather. Same people. One decision changed.” |

Read the actual displayed numbers. Do not promise a fixed reduction, a rejected plan, or a particular model response. A valid simulation plan may still leave substantial exposure concerns.

End with: **“We can inspect a decision before living with its consequences.”** Return to the deck for the evidence, partnership ask and closing.

## If something is slow or unavailable

- While Omar works, explain the visible tool trace. After roughly 15 seconds of waiting, use the prepared comparison if needed and say it was generated during rehearsal.
- If the model is unavailable, label rules-based output as fallback. Do not present it as live AI.
- If no valid plan returns, show the refusal honestly and use the disclosed prepared result to explain comparison.
- If speech fails, read the English translation and continue. Do not spend the pitch debugging audio.
- Avoid deliberately disconnecting the network during the main pitch. Reserve failure scenarios for questions.

## Evidence boundaries

Historical weather drives synthetic workers and a teaching model. The prototype is not clinically validated or UAE safety certification. Role-specific views demonstrate information separation; production authentication and consent management are not implemented. See the [scientific basis](scientific-basis.md).

## Verified baseline — 7 November 2026

Production Guardian, Noor and Omar returned model-generated responses using `gpt-6-luna`. A planner test returned `check.ok: true`. Speech returned HTTP 200 with a valid MP3, and the browser showed the connected assistant, model attribution, Listen interaction and a completed planning flow. These are functional checks, not clinical validation or guarantees of future uptime. Production deploys automatically from GitHub `main`.
