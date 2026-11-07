# Heatline — judges’ demo: first-person opening, then AI

A **25-second first-person opening**, a **35-second offline phone replay**, then **two minutes of AI and heat-safety decisions**. Total live-demo time: about three minutes.

Start with the site at human height. Then hear Anwar, watch Omar test a plan, and compare the shift.

[Open the live demo](https://heatline-plum.vercel.app) · [Pitch script](pitch-script.md) · [Google Slides](https://docs.google.com/presentation/d/1U0cnRU4kcdr1z3TvDzAg8BzZWnwEI871LIf-HcL61D0/edit)

## Before presenting

- Use a desktop or laptop with a browser window at least 1024 pixels wide. Test the venue’s sound and connection.
- On the landing page, rehearse **Explore on foot → Lift entrance → Board the lift → Level 12 → Step out → Esc**. This standalone playground does not start a shift, call an assistant or change simulation outcomes.
- Confirm **Assistant connected**, a model attribution on the guidance, and a working **Listen** button.
- Use **Explore** under **The afternoon pour** for direct control. Story mode adds narrative pauses.
- Keep a second tab with a completed plan and comparison. Identify it as a prepared result if you use it.
- Rehearse once with the actual display and speakers. Model wording, plans and response times vary.

## Opening wow moment — 25 seconds

Show the cover slide, say **“Before we talk about heat, step onto the site with me,”** and switch to the live landing page.

| Time | Action | Presenter cue |
| --- | --- | --- |
| 0:00–0:05 | Click **Explore on foot** directly on the landing page. Drag briefly to look up at the tower. | “This is the worksite at human height.” |
| 0:05–0:18 | Click **Lift entrance → Board the lift → Level 12**. Look out through the cage while it rises. | “You can walk the site, ride the lift and operate the crane. This is a separate playground—no shift has started.” |
| 0:18–0:25 | Click **Step out** once the lift arrives. Glance across the rooftop, then press **Esc** or **Back to home**. | “That was the playground. Now let’s make a decision that matters.” |

Use the lift shortcut rather than spending the opening walking to it. Do not add a crane ride to the timed opening. If the lift takes longer on the presentation machine, exit at 25 seconds and continue; a rooftop arrival is not required to make the transition.

Return to slides **2–3** for the worker introduction and rooftop visual. Use slide **4** for the phone replay.

## Anwar’s phone — 35 seconds

Before presenting, open the [supervisor dashboard](https://heatline-plum.vercel.app/worker/supervisor.html) on the laptop and choose **Start a fresh demo shift**. Verify Crew B shows zero. Ask a judge to scan the QR code on the laptop with their phone camera and open the worker page while connected. If scanning is unavailable, use **Copy worker link**. Starting a fresh shift generates a new code. Wait for **Ready for offline use**. Keep the laptop connected.

1. Disconnect the phone from Wi-Fi and cellular data. Reload the worker page. Point out the offline indicator.
2. Tap **Decline sharing**. “Anwar can decline the wearable and still receive this warning.” Show the Bengali instruction to rest in shade and drink water. This replays a stored yellow warning from the morning shift at 09:40.
3. Tap **I reached shade** while offline. Show the queued receipt and the laptop count of zero. Reconnect the phone with the page open. When the phone shows **Delivered**, the dashboard refreshes to one within its next successful poll. “The supervisor sees one arrival in Crew B. The phone sent a random receipt. Anwar’s name, wearable choice and health readings stayed off the dashboard.”
4. At slide **5**, move to the connected laptop. “That was Anwar’s morning. Now the supervisor has an afternoon pour to plan.” If delivery is delayed, leave the receipt queued and return to the dashboard after the AI segment.

## AI and heat-safety sequence — two minutes

The times below restart at the beginning of this segment.

| Time | Action | Presenter cue |
| --- | --- | --- |
| 0:00–0:15 | From the landing page, choose **Explore** under **The afternoon pour**, then **Deck**. This starts the scenario, unlike the opening playground. | “This is the site behind the warning.” |
| 0:15–0:40 | Select **Anwar**, show his Bengali guidance and press **Listen**. Point to Noor’s crew-level brief while speech prepares. | “A warning only helps if the person understands it. This voice is AI-generated.” |
| 0:40–1:15 | At **15:10**, playback pauses for the decision. Press **Ask Omar** with the default concrete-truck question. Point to the conditions and planning tool calls as they appear. | “He checks conditions and tests a proposed plan against the rules.” |
| 1:15–1:40 | Show the policy result **and the independent NIOSH exposure screen**. If a plan was refused and revised, point to that trace. | “Passing the demonstration policy doesn’t certify safety. The remaining exposure stays visible.” |
| 1:40–2:00 | For an accepted plan, click **Run this simulated plan**, then **Compare**. Highlight high-strain worker-minutes, exposure-screen findings and rest time. | “Same weather. Same people. One decision changed.” |

Read the actual displayed numbers. Do not promise a fixed reduction, a rejected plan, or a particular model response. A valid simulation plan may still leave substantial exposure concerns.

End with: **“We can inspect a decision before living with its consequences.”** Return to the deck for the evidence, partnership ask and closing.

![First-person rooftop view after the lift ride](images/first-person-opening.png)

## Optional Q&A moment — crane controls

From the landing page, use **Explore on foot → Crane base → Enter crane cab**. Hold **A/D** to rotate, **W/S** to move the trolley, and **Q/E** to raise or lower the hook. Press **Esc** to leave. Explain that these visual controls are separate from workers, schedules and heat-safety decisions. Keep this out of the main timed pitch.

## If something is slow or unavailable

- If first-person mode is slow, show slide 3 and move straight into the AI demo. Do not troubleshoot graphics on stage.
- While Omar works, explain the visible tool trace. After roughly 15 seconds of waiting, use the prepared comparison if needed and say it was generated during rehearsal.
- If the model is unavailable, label rules-based output as fallback. Do not present it as live AI.
- If no valid plan returns, show the refusal honestly and use the disclosed prepared result to explain comparison.
- If speech fails, read the English translation and continue. Do not spend the pitch debugging audio.
- If the phone was not prepared online, show slide 4 and describe the replay. Keep the laptop connected for the AI segment.

## Evidence boundaries

Historical weather drives synthetic workers and a teaching model. The prototype is not clinically validated or UAE safety certification. Role-specific views demonstrate information separation; production authentication and consent management are not implemented. See the [scientific basis](scientific-basis.md).

## Verified baseline — 7 November 2026

Production Guardian, Noor and Omar returned model-generated responses using `gpt-6-luna`. A planner test returned `check.ok: true`. Speech returned HTTP 200 with a valid MP3, and the browser showed the connected assistant, model attribution, Listen interaction and a completed planning flow. These are functional checks, not clinical validation or guarantees of future uptime. Production deploys automatically from GitHub `main`.

The standalone first-person entry was deployed in commit `a75cbe9`. Browser checks confirmed direct entry from the landing page and return home without mounting the simulation app.
