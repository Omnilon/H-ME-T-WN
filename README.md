# H-ME-T-WN
Pocket Worlds OSS is an open-source framework for persistent AI towns. It combines a pixel-world simulation with structured OpenAI-powered citizen planning so agents can form relationships, build households, respond to crises, and participate in civic life.
Pocket Worlds OSS is an open-source framework for building persistent AI towns in which autonomous citizens form relationships, marry, divorce, give birth, build homes, respond to disasters, and participate in civic life such as elections. The project combines a pixel-world renderer, an emergent social simulation, and a structured LLM planning layer that gives each citizen daily goals, priorities, and social intent.

Rather than calling a model continuously, Pocket Worlds uses a hybrid architecture: deterministic simulation handles moment-to-moment world updates, while OpenAI-powered planning is used for daily citizen intent and major world events such as fires, elections, births, household changes, and social conflict. This makes persistent agent societies more affordable, testable, and reproducible.

The open-source deliverables are: a reusable town simulation engine, a secure server-side OpenAI relay, prompt/schema definitions for citizen planning, a budget governor and fallback system, evaluation tooling for emergent behavior, and reference hosts for web and Apple platforms. Our goal is to make believable multi-agent social worlds accessible to independent developers, researchers, and open-source builders without requiring client-side API keys or unsafe deployment patterns.

How would you use API credits for your project?
We would use API credits to replace our mock planning backend with real OpenAI-powered citizen planning and to publish the results as open-source infrastructure. Credits would fund:

Structured daily planning for citizens using the Responses API
Event-triggered replanning for fires, elections, births, marriages, divorces, and civic crises
Evaluation runs to measure coherence, stability, cost, and behavioral diversity across long-lived towns
Development of a budget governor, caching strategy, and fallback-to-rules behavior so smaller teams can use LLM agents affordably
Safety and moderation patterns for social simulations involving relationships, political behavior, and disaster response
Open reference examples showing how to integrate OpenAI-backed agent societies into web and mobile products without exposing API keys in client apps
The result would be a public, reusable framework for persistent AI societies that other open-source projects can adopt and extend.

Anything else you’d like us to know?
A working prototype already exists with a pixel-agent runtime, emergent social systems, a native iOS/tvOS host, and a secure relay scaffold. The missing piece is real model-backed planning at development scale. We are intentionally designing this as open infrastructure first: the reusable simulation, orchestration, evaluation, and cost-control layers will be public so the broader ecosystem can build on them. Funding would let us validate the architecture with real model behavior and publish a credible reference implementation for long-running, socially rich agent worlds.
