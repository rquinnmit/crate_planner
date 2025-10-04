<concept_spec>
concept PlanExporter [Plan]

purpose allows the user to materialize a plan into a format that is supported by DJ software

principle exporting a finalized plan yields a playlist/crate that is suitable for import on a DJ software

state
a set of Exports with
	a plan Plan
	an exportFormat Format
	the date and time of export

actions
export(plan: Plan, format: Format): (export: Export)
requires the plan is finalized
effect generates an exportable file that can be downloaded by the user

</concept_spec>