# CratePilot

## Augmented Design of a Concept

### Old Design
concept CratePlanning [TrackId, Prompt]
purpose produce an ordered song crate that satisfies the given prompt
principle a crate plan respects the constraints of the prompt and maximizes the transition and preference utilities
state
a set of Prompts with
	an optional tempoRange Tuple<Float>
	an optional targetKey String
	an optional targetGenre String
	an optional sampleTracks List<TrackId>
	an optional targetDuration Integer
	an optional notes String
a set of Plans with
	a prompt Prompt
	a trackList Set<TrackId>
	a annotations String
	a totalDuration Integer
actions
createPlan(prompt: Prompt, seedTracks: List<TrackId>): (plan: Plan)
requires every track in seedTracks is a valid track
effect creates a draft order that satisfies the constraints and coverage of seed tracks

finalize(plan: Plan): ()
requires the duration is within tolerance
effect marks the plan as finalized, makes the ordering immutable, stores the plan in the library

recordFeedback(plan: Plan, feedback: String): ()
requires the plan has been finalized
effect stores feedback so that our model can learn and better its predictions


### Augmented Design

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
effect a) checks if plan.totalDuration is within the tolerance limits, b) verifies that no duplicate tracks exist in plan.trackList, and c) verifies that all tracks exist in our asset catalog

setLLMSettings(settings: LLMSettings): ()
requires true
effect updates the current settings of the LLM used



## Designed User Interaction


The user begins by filling out the prompt box with all of the information used to generate their set (desired BPM range, keys, vibe, setting, etc.). There is a panel where they can import seed tracks (tracks that match the gist of what the user is looking for in their set) for our LLM to analyze. Once the user enters the prompt, our LLM thinks for however long it needs to complete its decision making process, and it provides the user with some insights into the songs it's choosing. The LLM finishes processing and outputs a set of songs that it has pieced together for the generated set. The user can select “View” to view the chosen songs (and their details), export, and finalize the set. If the user is not satisfied with the set that was generated, they can reprompt the LLM with changes (in the same chat thread) and it will make edits to the set as needed. The LLM will, alongside the set it designs, provide the user with details as to why it chose those songs. If the user wants to navigate into any previous set generations, they can click the specified tabs on the left side of the screen.


## Richer Test Cases and Prompts

### Test Case 1: Sunset Rooftop Party

**Scenario:** A DJ needs to prepare a 60-minute tech house set for a rooftop sunset party. They want smooth energy progression starting mellow and building gradually.

**User Actions:**
1. **Initial Prompt:** `"Rooftop sunset party, tech house, 120-124 BPM, 60 minutes, smooth energy build"`
2. **Seed Tracks:** Provides 2 reference tracks (Charlotte de Witte - "Formula", Amelie Lens - "In My Mind")
3. **Review Generated Crate:** Sees 15 tracks with linear energy progression
4. **Revision Request:** `"Raise energy earlier in the set, avoid tracks by FISHER"`

**LLM Actions:**
1. **`deriveIntentLLM()`** - Analyzes prompt, generates structured intent
2. **`generateCandidatePoolLLM()`** - Searches Spotify for tech house tracks 120-124 BPM, selects 20 diverse candidates
3. **`sequencePlanLLM()`** - Orders tracks for smooth progression, creates 60-minute setlist
4. **`explainPlanLLM()`** - Generates annotations explaining track choices and energy flow
5. **`revisePlanLLM()`** - Applies user feedback -> reorders tracks, removes FISHER, increases early energy

**Prompt Variants:**
- **Variant A:** `"Sunset vibes, tech house, 120-124 BPM, 60 minutes"`
- **Variant B:** `"Rooftop party, smooth progressive energy, tech house, 60 minutes"`  
- **Variant C:** `"Evening set, building energy from chill to peak, tech house, 120-124 BPM"`

---

### Test Case 2: Peak Hour Club Set

**Scenario:** A club DJ needs an energetic 90-minute set for peak hours (11 PM - 12:30 AM). High energy throughout with strategic drops.

**User Actions:**
1. **Initial Prompt:** `"Peak hour club set, high energy, 125-130 BPM, 90 minutes, techno and tech house"`
2. **Seed Tracks:** Provides 3 high-energy tracks (Adam Beyer - "Your Mind", Charlotte de Witte - "Rave On", Amelie Lens - "In My Mind")
3. **Review Generated Crate:** Sees 20 tracks but notices too many tracks by same artist
4. **Revision Request:** `"More artist variety, add some peak-time techno drops"`
5. **Second Revision:** `"Lower BPM to 120-125 range, more accessible for crowd"`

**LLM Actions:**
1. **`deriveIntentLLM()`** - Identifies high-energy, peak-time intent → sets mixStyle: "energetic", energyCurve: "peak"
2. **`generateCandidatePoolLLM()`** - Searches for techno/tech house 125-130 BPM → finds 25 high-energy tracks
3. **`sequencePlanLLM()`** - Creates peak-time progression with strategic energy drops
4. **`revisePlanLLM()`** - Applies artist diversity filter → replaces duplicate artists with new ones
5. **`revisePlanLLM()`** - Adjusts BPM range → reselects tracks in 120-125 range
6. **`explainPlanLLM()`** - Explains peak-time strategy and drop placements

**Prompt Variants:**
- **Variant A:** `"Club peak hour, techno, high energy, 125-130 BPM, 90 minutes"`
- **Variant B:** `"Late night club set, peak time energy, techno and tech house, 90 minutes"`
- **Variant C:** `"Club closing set, maximum energy, techno drops, 125-130 BPM"`

---

### Test Case 3: Chill Lounge Session

**Scenario:** A lounge DJ needs a 45-minute ambient/downtempo set for early evening (6-7 PM). Focus on smooth transitions and atmospheric tracks.

**User Actions:**
1. **Initial Prompt:** `"Chill lounge music, ambient and downtempo, 90-100 BPM, 45 minutes, smooth transitions"`
2. **Seed Tracks:** Provides 2 atmospheric tracks (Bonobo - "Kerala", Tycho - "A Walk")
3. **Review Generated Crate:** Gets 12 tracks but some are too energetic
4. **Revision Request:** `"Lower energy level, more ambient, avoid tracks with heavy beats"`

**LLM Actions:**
1. **`deriveIntentLLM()`** - Recognizes chill/ambient intent
2. **`generateCandidatePoolLLM()`** - Searches for ambient/downtempo 90-100 BPM, selects 15 atmospheric tracks
3. **`sequencePlanLLM()`** - Creates smooth, uninterrupted flow for a 45-minute ambient journey
4. **`revisePlanLLM()`** - Filters out high-energy tracks, replaces with more ambient selections
5. **`explainPlanLLM()`** - Explains atmospheric progression and transition philosophy

**Prompt Variants:**
- **Variant A:** `"Lounge music, ambient, 90-100 BPM, 45 minutes"`
- **Variant B:** `"Chill session, downtempo and ambient, smooth flow, 45 minutes"`
- **Variant C:** `"Early evening lounge, atmospheric music, 90-100 BPM, no heavy beats"`

---

## Experimental Results & Analysis

### Experiment 1: Sunset Rooftop Party
**Approach:** Used LLM to derive structured intent from natural language ("smooth energy build") and generate a 60-minute tech house crate with linear energy progression. **What worked:** LLM successfully parsed "sunset party" context into appropriate BPM range (120-124) and smooth mix style. The revision loop allowed for fine-tuning. **What went wrong:** There are issues with the parsing/inputting of song BPMs, so all the songs fall back onto 120 BPM. Initial generation placed seed tracks suboptimally within the energy curve, and duration precision was off by 8 minutes despite constraints. **Issues that remain:** LLM sometimes misinterprets energy descriptors, and the revision process required multiple iterations to achieve the desired result.

### Experiment 2: Peak Hour Club Set
**Approach:** Tested LLM's ability to handle high-energy and peak-time scenarios with multiple revision requests and artist diversity constraints. **What worked:** LLM correctly identified peak-time intent and applied artist diversity filters effectively. The revision loop successfully handled both energy adjustments and BPM range changes. **What went wrong:** There are issues with the parsing/inputting of song BPMs, so all the songs fall back onto 120 BPM. Initial generation over-represented certain artists heavily (5 tracks from same artist). **Issues that remain:** Genre boundary detection is inconsistent (blurred techno vs tech house). Large revisions sometimes require multiple passes to achieve desired changes.

### Experiment 3: Chill Lounge Session
**Approach:** Evaluated LLM's performance with low-energy, more atmospheric music selection. **What worked:** LLM accurately recognized ambient/downtempo intent and set appropriate energy levels. The revision process filtered out high-energy tracks. **What went wrong:** There are issues with the parsing/inputting of song BPMs, so all the songs fall back onto 120 BPM. Some initially selected tracks were too energetic despite a more chill context, and the LLM struggled with the subjective nature of "heavy beats" in revision requests. **Issues that remain:** Energy remains subjective (1-5 scale may not align with user expectations), and the system lacks cultural context for more specific requirements.

---

## Validators in Code

Our three validators involved putting caps on the song crate duration, the max/min BPM levels, and invalid keys. This ensures that, even if the user puts in a prompt request for one of these invalid fields, our LLM cannot effectively output songs outside of these ranges. These validation checks are found inside of src/validation/constraints.ts, and they are run during out validation step (after the LLM produces a candidate and selection of tracks). It might be helpful to throw these checks before our LLM has the ability to output it's selected crate to the frontend.