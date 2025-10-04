<concept_spec>
concept CratePlanningAI [TrackId, Prompt]

purpose produce an ordered song crate that satisfies the given prompt

principle a crate plan respects the constraints of the prompt, assembles a candidate pool, and selects/orders tracks to maximize the preferences in the prompt. the prompts are dissected and processed by the LLM.

state
a set of Prompts with
	an optional tempoRange Tuple<Float>
	an optional targetKey String
	an optional targetGenre String
	an optional sampleTracks List<TrackId>
	an optional targetDuration Integer
	an optional notes String

a set of DerivedIntents with
	a tempoRange Tuple<Float>
	an allowedKeys List<String>
	a targetGenres List<String>
	a duration Integer
	a mixStyle String
	a mustIncludeArtists List<String>
	an avoidArtists List<String>
	a mustIncludeTracks List<String>
	an avoidTracks List<String>

a set of LLMSettings with
	a model String
	a temperature Float
	a promptTemplate String
	an outputTemplate String

a set of Plans with
	a prompt Prompt
	a trackList List<TrackId>
	an annotations String
	a totalDuration Integer
	a planDetails with
		an optional llmModel String
		an optional llmTraceId String

a set of CandidatePools with
	a sourcePrompt Prompt
	a set of tracks Set<TrackId>
	a filtersApplied String

actions
createPlan(prompt: Prompt, seedTracks: List<TrackId>): (plan: Plan)
requires every track in seedTracks is a valid track
effect creates a draft order that satisfies the constraints and coverage of seed tracks

deriveIntentLLM(prompt: Prompt, seedTracks: List<TrackId>): (intent: DerivedIntent)
requires plan exists and is valid
effect calls an LLM to process/analyze the information from the plan’s prompt and seed tracks; uses this information to generate a new intent that will include more structured constraints for track selection

generateCandidatePool(intent: DerivedIntent): (pool: CandidatePool)
requires intent is valid
effect uses the intent and an LLM to produce a set of track candidates

sequencePlan(intent: DerivedIntent, pool: CandidatePool, seedTracks: List<TrackId>?): (plan: Plan)
requires pool is nonempty
effect returns a plan with an ordered track list and duration

explainPlan(plan: Plan): (annotated: Plan)
requires true
effect calls an LLM to generate human-readable annotations for the generated crate

revisePlan(plan: Plan, instructions: String): (revised: Plan)
requires the plan exists
effect calls an LLM to apply constrained edits to the plan; rechecks to make sure all applied constraints, both new and old, are conserved

finalize(plan: Plan): ()
requires plan.totalDuration is within tolerance and plan.trackList has no duplicate tracks
effect marks the plan as immutable and stores it for export

validate(plan: Plan): (isValid: boolean, errors: List<String>?)
requires the plan exists
effect checks if plan.totalDuration is within the tolerance limits, verifies that no duplicate tracks exist in plan.trackList, and verifies that all tracks exist in our asset catalog

setLLMSettings(settings: LLMSettings): ()
requires true
effect updates the current settings of the LLM used
    
</concept_spec>