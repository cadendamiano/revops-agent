// Lightweight label lookup for client-side tool call display.
// Mirrors the label fields from lib/tools/**  — keep in sync when adding tools.
// Intentionally has NO imports that chain to server-only code (better-sqlite3, etc.).

const TOOL_LABELS: Record<string, string> = {
  // sf_data
  sf_data_query:                 'sf data query',
  sf_data_search:                'sf data search',
  sf_data_get_record:            'sf data get-record',
  sf_data_create:                'sf data create',
  sf_data_update:                'sf data update',
  sf_data_stage_change:          'sf data stage-change',
  sf_data_delete:                'sf data delete',
  submit_approved_sfdc_batch:    'Submit approved SFDC batch',

  // sf_sobject
  sf_sobject_describe:           'sf sobject describe',
  sf_sobject_list:               'sf sobject list',

  // sf_analytics
  sf_analytics_list_dashboards:  'sf analytics list dashboards',
  sf_analytics_get_dashboard:    'sf analytics get dashboard',
  sf_analytics_list_reports:     'sf analytics list reports',
  sf_analytics_run_report:       'sf analytics run report',

  // sf_case
  sf_case_list:                  'sf case list',
  sf_case_sla_breach:            'sf case sla-breach',

  // sf_activity
  sf_activity_list:              'sf activity list',
  sf_activity_log:               'sf activity log',

  // sf_approval
  sf_approval_queue:             'sf approval queue',
  sf_approval_decide:            'sf approval decide',

  // render (sfdc)
  render_soql_results:           'Open SOQL results',
  render_pipeline_kanban:        'Open pipeline kanban',
  render_account_360:            'Open account 360',
  render_lead_scoring:           'Open lead scoring',
  render_forecast:               'Open forecast',
  render_dashboard_tiles:        'Open dashboard',
  render_case_sla:               'Open case SLA heatmap',
  render_activity_timeline:      'Open activity timeline',
  render_bulk_update_preview:    'Open bulk-update preview',
  render_action_draft:           'Open action drafts',
  render_comparison:             'Open comparison',

  // render (generic)
  render_artifact:               'Open artifact',
  render_html_artifact:          'Build custom artifact',
  render_spreadsheet_artifact:   'Open spreadsheet',
  render_document_artifact:      'Open document',
  render_slides_artifact:        'Open slide deck',
  render_automation_artifact:    'Open automation',

  // chat affordances
  ask_question:                  'Ask clarifying question',
  offer_artifacts:               'Offer artifact options',

  // memory / session
  flag_records:                  'Flag records to memory',
  plan:                          'Propose a plan',
};

export function toolLabel(name: string): string {
  return TOOL_LABELS[name] ?? name;
}
