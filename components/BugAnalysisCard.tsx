'use client';

import { useState } from 'react';
import {
  AlertTriangle, Target, List, Eye, GitCompare, Cpu, Shield,
  Copy, Check, ChevronDown, ChevronRight, ExternalLink,
  TestTubes, Gauge, ClipboardCheck, Crosshair, Wrench,
  Users, Clock, CheckCircle2, XCircle,
} from 'lucide-react';
import { cn, severityColor, priorityLabel, getQualityScoreColor } from '@/lib/utils';
import type { BugReport, TestCase } from '@/types';

interface BugAnalysisCardProps {
  bug: BugReport;
  qualityScore?: Record<string, unknown>;
  testCases?: TestCase[];
  reproChecklist?: { checklist: string[]; scenarios: { name: string; steps: string[]; expectedOutcome: string }[] };
  duplicates?: Record<string, unknown>;
}

// Safely read extended fields from the bug (they may or may not exist on older data)
function ext(bug: BugReport) {
  const b = bug as unknown as Record<string, unknown>;
  return {
    defectId: b.defectId as string | undefined,
    severityJustification: b.severityJustification as string | undefined,
    priorityJustification: b.priorityJustification as string | undefined,
    classification: b.classification as { defectType?: string; reproducibility?: string; reproductionNotes?: string } | undefined,
    rootCauseAnalysis: b.rootCauseAnalysis as Array<{
      hypothesis: string; confidence: number; affectedArea?: string;
      investigationSteps?: string[]; rootCauseCategory?: string;
    }> | undefined,
    impactRadius: b.impactRadius as {
      affectedUserSegments?: string;
      affectedFeatures?: { primary?: string[]; downstream?: string[] };
      businessImpact?: string;
      dataIntegrityRisk?: string;
    } | undefined,
    recommendedFix: b.recommendedFix as {
      approach?: string; estimatedEffort?: string; workaround?: string; regressionRisk?: string;
    } | undefined,
    testingRecommendations: b.testingRecommendations as {
      newTestCases?: string[]; regressionScope?: string; verificationApproach?: string;
    } | undefined,
    triageRecommendation: b.triageRecommendation as {
      owningTeam?: string; sprintRecommendation?: string; sla?: string;
    } | undefined,
    negativeSpace: b.negativeSpace as {
      workingFeatures?: string[]; nonReproducingConditions?: string[];
    } | undefined,
    clarificationNeeded: b.clarificationNeeded as string[] | undefined,
    confidence: (b.confidence as number) ?? (bug.aiAnalysis?.confidence),
  };
}

export default function BugAnalysisCard({ bug, qualityScore, testCases, reproChecklist, duplicates }: BugAnalysisCardProps) {
  const [copied, setCopied] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    overview: true, steps: true, classification: false, rootCause: false,
    impact: false, fix: false, testing: false, triage: false,
    negativeSpace: false, tests: false, checklist: false,
  });

  const e = ext(bug);

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const copyToClipboard = () => {
    const id = e.defectId ? `${e.defectId}\n` : '';
    const text = `${id}# ${bug.title}\n\n## Description\n${bug.description}\n\n## Severity: ${bug.severity} | Priority: ${bug.priority}\n${e.severityJustification ? `Justification: ${e.severityJustification}\n` : ''}\n## Steps to Reproduce\n${bug.stepsToReproduce.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\n## Expected Result\n${bug.expectedResult}\n\n## Actual Result\n${bug.actualResult}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const SectionHeader = ({ id, icon: Icon, title, badge, color }: { id: string; icon: React.ElementType; title: string; badge?: string; color?: string }) => (
    <button
      onClick={() => toggleSection(id)}
      className="w-full flex items-center gap-3 py-3 text-left group"
    >
      <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center group-hover:bg-bg-hover transition-colors', color ? `${color.replace('text-', 'bg-')}/10` : 'bg-bg-tertiary')}>
        <Icon className={cn('w-4 h-4', color ?? 'text-text-secondary')} />
      </div>
      <span className="text-sm font-semibold text-text-primary flex-1">{title}</span>
      {badge && <span className="text-xs text-text-muted bg-bg-tertiary px-2 py-0.5 rounded-full">{badge}</span>}
      {expandedSections[id] ? <ChevronDown className="w-4 h-4 text-text-muted" /> : <ChevronRight className="w-4 h-4 text-text-muted" />}
    </button>
  );

  return (
    <div className="space-y-4 animate-slide-up">
      {/* ── Header Card ──────────────────────────────────────────────── */}
      <div className="glass-panel p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex-1">
            {e.defectId && (
              <span className="text-xs font-mono text-text-muted mb-1 block">{e.defectId}</span>
            )}
            <h3 className="text-lg font-bold text-text-primary leading-tight mb-2">{bug.title}</h3>
            <p className="text-sm text-text-secondary leading-relaxed">{bug.description}</p>
          </div>
          <button onClick={copyToClipboard} className="btn-ghost flex-shrink-0">
            {copied ? <Check className="w-4 h-4 text-accent-emerald" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>

        {/* Badges */}
        <div className="flex flex-wrap gap-2 mb-3">
          <span className={cn('badge', severityColor(bug.severity))}>
            <AlertTriangle className="w-3 h-3 mr-1" />
            {bug.severity}
          </span>
          <span className="badge bg-accent-violet/15 text-accent-violet border border-accent-violet/20">
            <Target className="w-3 h-3 mr-1" />
            {bug.priority} — {priorityLabel(bug.priority)}
          </span>
          {e.classification?.defectType && (
            <span className="badge bg-accent-cyan/15 text-accent-cyan border border-accent-cyan/20">
              {e.classification.defectType}
            </span>
          )}
          {e.classification?.reproducibility && (
            <span className="badge bg-bg-tertiary text-text-secondary border-border">
              {e.classification.reproducibility}
            </span>
          )}
          {bug.tags.slice(0, 4).map((tag) => (
            <span key={tag} className="badge bg-bg-tertiary text-text-secondary border-border">{tag}</span>
          ))}
        </div>

        {/* Severity / Priority Justification */}
        {(e.severityJustification || e.priorityJustification) && (
          <div className="space-y-2 mt-3 pt-3 border-t border-border">
            {e.severityJustification && (
              <div className="p-2.5 rounded-lg bg-bg-tertiary">
                <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Severity Rationale</span>
                <p className="text-xs text-text-secondary mt-0.5">{e.severityJustification}</p>
              </div>
            )}
            {e.priorityJustification && (
              <div className="p-2.5 rounded-lg bg-bg-tertiary">
                <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Priority Rationale</span>
                <p className="text-xs text-text-secondary mt-0.5">{e.priorityJustification}</p>
              </div>
            )}
          </div>
        )}

        {/* Quality Score */}
        {qualityScore && <QualityScoreSection qualityScore={qualityScore} />}
      </div>

      {/* ── Steps to Reproduce ───────────────────────────────────────── */}
      <div className="glass-panel px-6 divide-y divide-border">
        <SectionHeader id="steps" icon={List} title="Steps to Reproduce" badge={`${bug.stepsToReproduce.length} steps`} />
        {expandedSections.steps && (
          <div className="py-4 space-y-2">
            {bug.stepsToReproduce.map((step, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-accent-blue/10 text-accent-blue text-xs font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                <span className="text-sm text-text-secondary leading-relaxed">{step}</span>
              </div>
            ))}
            <div className="grid grid-cols-2 gap-3 mt-4 pt-3 border-t border-border">
              <div className="p-3 rounded-xl bg-accent-emerald/5 border border-accent-emerald/10">
                <div className="flex items-center gap-1.5 mb-1">
                  <Eye className="w-3 h-3 text-accent-emerald" />
                  <span className="text-xs font-medium text-accent-emerald">Expected</span>
                </div>
                <p className="text-xs text-text-secondary">{bug.expectedResult}</p>
              </div>
              <div className="p-3 rounded-xl bg-accent-coral/5 border border-accent-coral/10">
                <div className="flex items-center gap-1.5 mb-1">
                  <AlertTriangle className="w-3 h-3 text-accent-coral" />
                  <span className="text-xs font-medium text-accent-coral">Actual</span>
                </div>
                <p className="text-xs text-text-secondary">{bug.actualResult}</p>
              </div>
            </div>
            {e.classification?.reproductionNotes && (
              <div className="p-2.5 rounded-lg bg-bg-tertiary mt-2">
                <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Reproduction Notes</span>
                <p className="text-xs text-text-secondary mt-0.5">{e.classification.reproductionNotes}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Environment ──────────────────────────────────────────────── */}
      {bug.environment && (
        <div className="glass-panel p-6">
          <div className="flex items-center gap-2 mb-3">
            <Cpu className="w-4 h-4 text-text-muted" />
            <span className="text-sm font-semibold text-text-primary">Environment</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(bug.environment).filter(([, v]) => v && v !== 'Not specified').map(([key, val]) => (
              <div key={key} className="p-2.5 rounded-lg bg-bg-tertiary">
                <span className="text-[10px] text-text-muted uppercase tracking-wider">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                <p className="text-xs text-text-primary font-medium mt-0.5">{val}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Root Cause Analysis (enterprise) ─────────────────────────── */}
      {e.rootCauseAnalysis && e.rootCauseAnalysis.length > 0 ? (
        <div className="glass-panel px-6 divide-y divide-border">
          <SectionHeader id="rootCause" icon={Shield} title="Root Cause Analysis" badge={`${e.rootCauseAnalysis.length} hypotheses`} color="text-accent-amber" />
          {expandedSections.rootCause && (
            <div className="py-4 space-y-3">
              {e.rootCauseAnalysis.map((rca, i) => (
                <div key={i} className="p-4 rounded-xl bg-bg-tertiary border border-border">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-accent-amber">Hypothesis #{i + 1}</span>
                      {rca.rootCauseCategory && (
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-bg-hover text-text-muted border border-border">{rca.rootCauseCategory}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <div className="w-16 h-1.5 bg-bg-hover rounded-full overflow-hidden">
                        <div className={cn('h-full rounded-full', rca.confidence >= 70 ? 'bg-accent-emerald' : rca.confidence >= 40 ? 'bg-accent-amber' : 'bg-accent-coral')} style={{ width: `${rca.confidence}%` }} />
                      </div>
                      <span className="text-xs font-mono text-text-muted">{rca.confidence}%</span>
                    </div>
                  </div>
                  <p className="text-sm text-text-secondary mb-2">{rca.hypothesis}</p>
                  {rca.affectedArea && (
                    <p className="text-xs text-text-muted mb-2"><span className="font-medium">Affected area:</span> <span className="font-mono">{rca.affectedArea}</span></p>
                  )}
                  {rca.investigationSteps && rca.investigationSteps.length > 0 && (
                    <div>
                      <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Investigation Steps</span>
                      <div className="mt-1 space-y-1">
                        {rca.investigationSteps.map((step, j) => (
                          <div key={j} className="flex items-start gap-2">
                            <span className="text-[10px] text-accent-blue font-mono mt-0.5">{j + 1}.</span>
                            <span className="text-xs text-text-secondary">{step}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Fallback: legacy rootCauseHypotheses + aiAnalysis */
        <div className="glass-panel px-6 divide-y divide-border">
          <SectionHeader id="rootCause" icon={Shield} title="AI Root Cause Analysis" badge={bug.aiAnalysis ? `${Math.round(bug.aiAnalysis.confidence * 100)}% confidence` : undefined} />
          {expandedSections.rootCause && (
            <div className="py-4 space-y-4">
              <div>
                <span className="text-xs font-medium text-text-muted uppercase tracking-wider">Hypotheses</span>
                <div className="mt-2 space-y-2">
                  {bug.rootCauseHypotheses.map((h, i) => (
                    <div key={i} className="flex items-start gap-2 p-3 rounded-xl bg-bg-tertiary">
                      <span className="text-accent-amber text-sm">#{i + 1}</span>
                      <span className="text-sm text-text-secondary">{typeof h === 'string' ? h : (h as Record<string, string>).hypothesis ?? JSON.stringify(h)}</span>
                    </div>
                  ))}
                </div>
              </div>
              {bug.aiAnalysis && (
                <>
                  <div>
                    <span className="text-xs font-medium text-text-muted uppercase tracking-wider">Technical Details</span>
                    <p className="text-sm text-text-secondary mt-1 leading-relaxed">{bug.aiAnalysis.technicalDetails}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-accent-blue/5 border border-accent-blue/10">
                    <span className="text-xs font-medium text-accent-blue">Suggested Fix</span>
                    <p className="text-sm text-text-secondary mt-1">{bug.aiAnalysis.suggestedFix}</p>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Impact Radius (enterprise) ───────────────────────────────── */}
      {e.impactRadius ? (
        <div className="glass-panel px-6 divide-y divide-border">
          <SectionHeader id="impact" icon={Crosshair} title="Impact Radius" color="text-accent-coral" />
          {expandedSections.impact && (
            <div className="py-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-bg-tertiary">
                  <span className="text-[10px] text-text-muted uppercase tracking-wider">Affected Users</span>
                  <p className="text-sm text-text-primary font-medium mt-0.5">{e.impactRadius.affectedUserSegments}</p>
                </div>
                <div className="p-3 rounded-xl bg-bg-tertiary">
                  <span className="text-[10px] text-text-muted uppercase tracking-wider">Data Integrity Risk</span>
                  <p className="text-sm text-text-primary font-medium mt-0.5">{e.impactRadius.dataIntegrityRisk ?? 'Not assessed'}</p>
                </div>
              </div>
              {e.impactRadius.affectedFeatures && (
                <div className="p-3 rounded-xl bg-bg-tertiary">
                  <span className="text-[10px] text-text-muted uppercase tracking-wider">Affected Features</span>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {e.impactRadius.affectedFeatures.primary?.map((f) => (
                      <span key={f} className="text-xs px-2 py-0.5 rounded-md bg-accent-coral/10 text-accent-coral border border-accent-coral/20 font-medium">{f}</span>
                    ))}
                    {e.impactRadius.affectedFeatures.downstream?.map((f) => (
                      <span key={f} className="text-xs px-2 py-0.5 rounded-md bg-accent-amber/10 text-accent-amber border border-accent-amber/20">{f}</span>
                    ))}
                  </div>
                  {e.impactRadius.affectedFeatures.downstream && e.impactRadius.affectedFeatures.downstream.length > 0 && (
                    <p className="text-[10px] text-text-muted mt-1.5">Coral = primary, Amber = downstream dependencies</p>
                  )}
                </div>
              )}
              <div className="p-3 rounded-xl bg-bg-tertiary">
                <span className="text-[10px] text-text-muted uppercase tracking-wider">Business Impact</span>
                <p className="text-sm text-text-secondary mt-0.5">{e.impactRadius.businessImpact}</p>
              </div>
            </div>
          )}
        </div>
      ) : bug.impactPrediction ? (
        /* Fallback: legacy impactPrediction */
        <div className="glass-panel px-6 divide-y divide-border">
          <SectionHeader id="impact" icon={Target} title="Impact Prediction" />
          {expandedSections.impact && (
            <div className="py-4 grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-bg-tertiary">
                <span className="text-[10px] text-text-muted uppercase">User Impact</span>
                <p className={cn('text-sm font-bold', severityColor(bug.impactPrediction.userImpact))}>{bug.impactPrediction.userImpact}</p>
              </div>
              <div className="p-3 rounded-xl bg-bg-tertiary">
                <span className="text-[10px] text-text-muted uppercase">Users Affected</span>
                <p className="text-sm font-bold text-text-primary">{bug.impactPrediction.estimatedUsersImpacted}</p>
              </div>
              <div className="col-span-2 p-3 rounded-xl bg-bg-tertiary">
                <span className="text-[10px] text-text-muted uppercase">Business Impact</span>
                <p className="text-sm text-text-secondary mt-0.5">{bug.impactPrediction.businessImpact}</p>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {/* ── Recommended Fix ──────────────────────────────────────────── */}
      {e.recommendedFix && (
        <div className="glass-panel px-6 divide-y divide-border">
          <SectionHeader id="fix" icon={Wrench} title="Recommended Fix" badge={e.recommendedFix.estimatedEffort} color="text-accent-blue" />
          {expandedSections.fix && (
            <div className="py-4 space-y-3">
              <div className="p-3 rounded-xl bg-accent-blue/5 border border-accent-blue/10">
                <span className="text-xs font-medium text-accent-blue">Approach</span>
                <p className="text-sm text-text-secondary mt-1">{e.recommendedFix.approach}</p>
              </div>
              {e.recommendedFix.workaround && e.recommendedFix.workaround !== 'No workaround available' && (
                <div className="p-3 rounded-xl bg-accent-amber/5 border border-accent-amber/10">
                  <span className="text-xs font-medium text-accent-amber">Temporary Workaround</span>
                  <p className="text-sm text-text-secondary mt-1">{e.recommendedFix.workaround}</p>
                </div>
              )}
              {e.recommendedFix.regressionRisk && (
                <div className="p-3 rounded-xl bg-accent-coral/5 border border-accent-coral/10">
                  <span className="text-xs font-medium text-accent-coral">Regression Risk</span>
                  <p className="text-sm text-text-secondary mt-1">{e.recommendedFix.regressionRisk}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Testing Recommendations ──────────────────────────────────── */}
      {e.testingRecommendations && (
        <div className="glass-panel px-6 divide-y divide-border">
          <SectionHeader id="testing" icon={TestTubes} title="Testing Recommendations" badge={e.testingRecommendations.newTestCases ? `${e.testingRecommendations.newTestCases.length} new tests` : undefined} color="text-accent-emerald" />
          {expandedSections.testing && (
            <div className="py-4 space-y-3">
              {e.testingRecommendations.newTestCases && e.testingRecommendations.newTestCases.length > 0 && (
                <div>
                  <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">New Test Cases to Add</span>
                  <div className="mt-1.5 space-y-1.5">
                    {e.testingRecommendations.newTestCases.map((tc, i) => (
                      <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-bg-tertiary">
                        <CheckCircle2 className="w-3.5 h-3.5 text-accent-emerald mt-0.5 flex-shrink-0" />
                        <span className="text-xs text-text-secondary">{tc}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {e.testingRecommendations.regressionScope && (
                <div className="p-2.5 rounded-lg bg-bg-tertiary">
                  <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Regression Scope</span>
                  <p className="text-xs text-text-secondary mt-0.5">{e.testingRecommendations.regressionScope}</p>
                </div>
              )}
              {e.testingRecommendations.verificationApproach && (
                <div className="p-2.5 rounded-lg bg-bg-tertiary">
                  <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Verification Approach</span>
                  <p className="text-xs text-text-secondary mt-0.5">{e.testingRecommendations.verificationApproach}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Triage Recommendation ────────────────────────────────────── */}
      {e.triageRecommendation && (
        <div className="glass-panel px-6 divide-y divide-border">
          <SectionHeader id="triage" icon={Users} title="Triage Recommendation" color="text-accent-violet" />
          {expandedSections.triage && (
            <div className="py-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-bg-tertiary">
                  <span className="text-[10px] text-text-muted uppercase tracking-wider">Owning Team</span>
                  <p className="text-sm text-text-primary font-medium mt-0.5">{e.triageRecommendation.owningTeam}</p>
                </div>
                <div className="p-3 rounded-xl bg-bg-tertiary">
                  <span className="text-[10px] text-text-muted uppercase tracking-wider">Sprint</span>
                  <p className="text-sm text-text-primary font-medium mt-0.5">{e.triageRecommendation.sprintRecommendation}</p>
                </div>
                <div className="p-3 rounded-xl bg-bg-tertiary">
                  <span className="text-[10px] text-text-muted uppercase tracking-wider">SLA</span>
                  <p className="text-sm text-text-primary font-medium mt-0.5">{e.triageRecommendation.sla}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Negative Space ───────────────────────────────────────────── */}
      {e.negativeSpace && (e.negativeSpace.workingFeatures?.length || e.negativeSpace.nonReproducingConditions?.length) && (
        <div className="glass-panel px-6 divide-y divide-border">
          <SectionHeader id="negativeSpace" icon={CheckCircle2} title="What's NOT Affected" color="text-accent-emerald" />
          {expandedSections.negativeSpace && (
            <div className="py-4 space-y-3">
              {e.negativeSpace.workingFeatures && e.negativeSpace.workingFeatures.length > 0 && (
                <div>
                  <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Confirmed Working</span>
                  <div className="mt-1.5 space-y-1">
                    {e.negativeSpace.workingFeatures.map((f, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-accent-emerald mt-0.5 flex-shrink-0" />
                        <span className="text-xs text-text-secondary">{f}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {e.negativeSpace.nonReproducingConditions && e.negativeSpace.nonReproducingConditions.length > 0 && (
                <div>
                  <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Does NOT Reproduce Under</span>
                  <div className="mt-1.5 space-y-1">
                    {e.negativeSpace.nonReproducingConditions.map((c, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <XCircle className="w-3.5 h-3.5 text-text-muted mt-0.5 flex-shrink-0" />
                        <span className="text-xs text-text-secondary">{c}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Clarification Needed ─────────────────────────────────────── */}
      {e.clarificationNeeded && e.clarificationNeeded.length > 0 && (
        <div className="glass-panel p-6">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-accent-amber" />
            <span className="text-sm font-semibold text-accent-amber">Clarification Needed</span>
          </div>
          <div className="space-y-1.5">
            {e.clarificationNeeded.map((q, i) => (
              <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-accent-amber/5 border border-accent-amber/10">
                <span className="text-xs font-mono text-accent-amber mt-0.5">?</span>
                <span className="text-xs text-text-secondary">{q}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Generated Test Cases ─────────────────────────────────────── */}
      {testCases && testCases.length > 0 && (
        <div className="glass-panel px-6 divide-y divide-border">
          <SectionHeader id="tests" icon={TestTubes} title="Generated Test Cases" badge={`${testCases.length} tests`} />
          {expandedSections.tests && (
            <div className="py-4 space-y-3">
              {testCases.map((tc, i) => (
                <div key={i} className="p-4 rounded-xl bg-bg-tertiary border border-border">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h4 className="text-sm font-semibold text-text-primary">{tc.title}</h4>
                    <span className="badge bg-bg-hover text-text-muted border-border text-[10px]">{tc.type}</span>
                  </div>
                  <p className="text-xs text-text-secondary mb-2">{tc.description}</p>
                  <div className="space-y-1">
                    {tc.steps.map((step, j) => (
                      <div key={j} className="flex items-start gap-2">
                        <span className="text-[10px] text-text-muted font-mono mt-0.5">{j + 1}.</span>
                        <span className="text-xs text-text-secondary">{step}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 pt-2 border-t border-border">
                    <span className="text-[10px] text-accent-emerald font-medium">Expected: </span>
                    <span className="text-xs text-text-secondary">{tc.expectedResult}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Reproduction Checklist ───────────────────────────────────── */}
      {reproChecklist && (
        <div className="glass-panel px-6 divide-y divide-border">
          <SectionHeader id="checklist" icon={ClipboardCheck} title="Reproduction Checklist" badge={`${reproChecklist.checklist.length} items`} />
          {expandedSections.checklist && (
            <div className="py-4 space-y-4">
              <div className="space-y-2">
                {reproChecklist.checklist.map((item, i) => (
                  <label key={i} className="flex items-start gap-3 p-2 rounded-lg hover:bg-bg-tertiary cursor-pointer group transition-colors">
                    <input type="checkbox" className="mt-1 rounded border-border accent-accent-blue" />
                    <span className="text-sm text-text-secondary group-hover:text-text-primary transition-colors">{item}</span>
                  </label>
                ))}
              </div>
              {reproChecklist.scenarios.length > 0 && (
                <div>
                  <span className="text-xs font-medium text-text-muted uppercase tracking-wider">Reproduction Scenarios</span>
                  <div className="mt-2 space-y-2">
                    {reproChecklist.scenarios.map((sc, i) => (
                      <div key={i} className="p-3 rounded-xl bg-bg-tertiary">
                        <h5 className="text-sm font-medium text-text-primary mb-1">{sc.name}</h5>
                        {sc.steps.map((step, j) => (
                          <p key={j} className="text-xs text-text-secondary ml-3">• {step}</p>
                        ))}
                        <p className="text-xs text-accent-emerald mt-1">Expected: {sc.expectedOutcome}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Duplicate Detection ──────────────────────────────────────── */}
      <DuplicateSection duplicates={duplicates} />

      {/* ── Export Buttons ────────────────────────────────────────────── */}
      <div className="flex gap-3">
        <button className="btn-secondary flex-1">
          <ExternalLink className="w-4 h-4" /> Export to Jira
        </button>
        <button className="btn-secondary flex-1">
          <ExternalLink className="w-4 h-4" /> Export to GitHub
        </button>
        <button onClick={copyToClipboard} className="btn-secondary">
          {copied ? <Check className="w-4 h-4 text-accent-emerald" /> : <Copy className="w-4 h-4" />}
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
    </div>
  );
}

// ── Quality Score Section ─────────────────────────────────────────────────────

const RATING_COLORS: Record<string, string> = {
  'Godsend': 'text-accent-emerald bg-accent-emerald/15',
  'Completionist': 'text-accent-blue bg-accent-blue/15',
  'Literalist': 'text-accent-amber bg-accent-amber/15',
  'Novice': 'text-accent-coral bg-accent-coral/15',
  'Needs Work': 'text-accent-coral bg-accent-coral/15',
};

function QualityScoreSection({ qualityScore }: { qualityScore: Record<string, unknown> }) {
  const score = (qualityScore.score as number) ?? 0;
  const rating = qualityScore.rating as string | undefined;
  const breakdown = qualityScore.breakdown as Record<string, Record<string, unknown>> | Record<string, number> | undefined;
  const suggestions = qualityScore.suggestions as Array<Record<string, string>> | string[] | undefined;
  const strengths = qualityScore.strengths as string[] | undefined;
  const summary = qualityScore.summary as string | undefined;

  // Detect new format (objects with score/max/percentage) vs old (plain numbers)
  const isNewFormat = breakdown && typeof Object.values(breakdown)[0] === 'object';

  return (
    <div className="mt-4 pt-4 border-t border-border">
      {/* Header with score and rating */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Gauge className="w-4 h-4 text-text-muted" />
          <span className="text-sm font-medium text-text-primary">Report Quality Score</span>
          {rating && (
            <span className={cn('text-[10px] px-2 py-0.5 rounded-md font-bold', RATING_COLORS[rating] || 'bg-bg-tertiary text-text-muted')}>
              {rating}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={cn('text-2xl font-bold font-mono', getQualityScoreColor(score))}>{score}</span>
          <span className="text-xs text-text-muted">/ 100</span>
        </div>
      </div>

      {/* Summary */}
      {summary ? <p className="text-xs text-text-secondary mb-3">{summary}</p> : null}

      {/* Dimension Breakdown */}
      {breakdown && isNewFormat ? (
        <div className="space-y-2 mb-3">
          {Object.entries(breakdown as Record<string, Record<string, unknown>>).map(([key, dim]) => {
            const dimScore = (dim.score as number) ?? 0;
            const dimMax = (dim.max as number) ?? 100;
            const dimPct = (dim.percentage as number) ?? Math.round((dimScore / dimMax) * 100);
            return (
              <div key={key}>
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[10px] text-text-muted capitalize">{key}</span>
                  <span className="text-[10px] font-mono text-text-muted">{dimScore}/{dimMax}</span>
                </div>
                <div className="h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all', dimPct >= 70 ? 'bg-accent-emerald' : dimPct >= 50 ? 'bg-accent-amber' : 'bg-accent-coral')}
                    style={{ width: `${dimPct}%` }}
                  />
                </div>
                {dim.details ? <p className="text-[10px] text-text-muted mt-0.5">{dim.details as string}</p> : null}
              </div>
            );
          })}
        </div>
      ) : breakdown ? (
        /* Old format: plain number breakdown */
        <div className="grid grid-cols-5 gap-2 mb-3">
          {Object.entries(breakdown as Record<string, number>).map(([key, val]) => (
            <div key={key} className="text-center">
              <div className="h-1 bg-bg-tertiary rounded-full overflow-hidden mb-1">
                <div className={cn('h-full rounded-full', val >= 80 ? 'bg-accent-emerald' : val >= 60 ? 'bg-accent-amber' : 'bg-accent-coral')} style={{ width: `${val}%` }} />
              </div>
              <span className="text-[10px] text-text-muted capitalize">{key}</span>
            </div>
          ))}
        </div>
      ) : null}

      {/* Strengths */}
      {strengths && strengths.length > 0 ? (
        <div className="mb-3">
          <span className="text-[10px] font-semibold text-accent-emerald uppercase tracking-wider">Strengths</span>
          <div className="mt-1 space-y-0.5">
            {strengths.map((s, i) => (
              <div key={i} className="flex items-start gap-1.5">
                <CheckCircle2 className="w-3 h-3 text-accent-emerald mt-0.5 flex-shrink-0" />
                <span className="text-[10px] text-text-secondary">{s}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Suggestions */}
      {suggestions && suggestions.length > 0 ? (
        <div>
          <span className="text-[10px] font-semibold text-accent-amber uppercase tracking-wider">Improvement Suggestions</span>
          <div className="mt-1 space-y-1">
            {suggestions.map((s, i) => {
              if (typeof s === 'string') {
                return <p key={i} className="text-[10px] text-text-muted">• {s}</p>;
              }
              const sug = s as Record<string, string>;
              return (
                <div key={i} className="p-2 rounded-lg bg-bg-tertiary">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[10px] capitalize text-text-muted">{sug.dimension}</span>
                    {sug.priority ? (
                      <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium',
                        sug.priority === 'High' ? 'bg-accent-coral/15 text-accent-coral' :
                        sug.priority === 'Medium' ? 'bg-accent-amber/15 text-accent-amber' :
                        'bg-accent-emerald/15 text-accent-emerald'
                      )}>{sug.priority}</span>
                    ) : null}
                    {sug.impact ? <span className="text-[10px] text-accent-emerald ml-auto">{sug.impact}</span> : null}
                  </div>
                  <p className="text-[10px] text-text-secondary">{sug.suggestion}</p>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ── Duplicate Detection Section ──────────────────────────────────────────────

function DuplicateSection({ duplicates }: { duplicates?: Record<string, unknown> }) {
  if (!duplicates) return null;

  // Handle both old format (array) and new format (object with duplicates/clusters)
  const dupList = Array.isArray(duplicates)
    ? duplicates as Array<Record<string, unknown>>
    : Array.isArray(duplicates.duplicates)
      ? duplicates.duplicates as Array<Record<string, unknown>>
      : [];
  const clusters = Array.isArray(duplicates.clusters) ? duplicates.clusters as Array<Record<string, unknown>> : [];
  const summary = duplicates.summary as Record<string, number> | undefined;

  if (dupList.length === 0 && clusters.length === 0) return null;

  const recColors: Record<string, string> = {
    'Link as Duplicate': 'bg-accent-coral/15 text-accent-coral',
    'Related but Distinct': 'bg-accent-amber/15 text-accent-amber',
    'Investigate Further': 'bg-accent-blue/15 text-accent-blue',
  };

  const confColors: Record<string, string> = {
    High: 'text-accent-coral',
    Medium: 'text-accent-amber',
    Low: 'text-accent-emerald',
  };

  return (
    <>
      {dupList.length > 0 && (
        <div className="glass-panel p-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <GitCompare className="w-4 h-4 text-accent-amber" />
              <span className="text-sm font-semibold text-accent-amber">Potential Duplicates ({dupList.length})</span>
            </div>
            {summary && (
              <div className="flex items-center gap-2 text-[10px] text-text-muted">
                {summary.highConfidence > 0 && <span className="text-accent-coral">{summary.highConfidence} high</span>}
                {summary.mediumConfidence > 0 && <span className="text-accent-amber">{summary.mediumConfidence} medium</span>}
                {summary.lowConfidence > 0 && <span className="text-accent-emerald">{summary.lowConfidence} low</span>}
              </div>
            )}
          </div>

          {dupList.map((d, i) => {
            const breakdown = d.similarityBreakdown as Record<string, number> | undefined;
            const evidence = d.matchingEvidence as string[] | undefined;
            const sim = typeof d.similarity === 'number' ? d.similarity : 0;
            const simPct = sim > 1 ? sim : Math.round(sim * 100);

            return (
              <div key={i} className="p-4 rounded-xl bg-bg-tertiary border border-border mb-3 last:mb-0">
                {/* Header */}
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <span className="text-xs font-mono text-text-muted">{d.id as string}</span>
                    {d.title ? <p className="text-sm text-text-primary font-medium mt-0.5">{d.title as string}</p> : null}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={cn('text-xs font-bold', simPct >= 85 ? 'text-accent-coral' : simPct >= 60 ? 'text-accent-amber' : 'text-accent-emerald')}>
                      {simPct}%
                    </span>
                    {d.confidence ? (
                      <span className={cn('text-[10px] font-medium', confColors[d.confidence as string] || 'text-text-muted')}>
                        {d.confidence as string}
                      </span>
                    ) : null}
                  </div>
                </div>

                {/* Similarity Breakdown */}
                {breakdown && (
                  <div className="grid grid-cols-4 gap-2 mb-2">
                    {Object.entries(breakdown).map(([key, val]) => (
                      <div key={key} className="text-center">
                        <div className="h-1 bg-bg-hover rounded-full overflow-hidden mb-0.5">
                          <div className={cn('h-full rounded-full', val >= 80 ? 'bg-accent-coral' : val >= 50 ? 'bg-accent-amber' : 'bg-accent-emerald')} style={{ width: `${val}%` }} />
                        </div>
                        <span className="text-[10px] text-text-muted capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Matching Evidence */}
                {evidence && evidence.length > 0 ? (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {evidence.map((e, j) => (
                      <span key={j} className="text-[10px] px-1.5 py-0.5 rounded bg-bg-hover text-text-muted border border-border">{e}</span>
                    ))}
                  </div>
                ) : null}

                {/* Recommendation */}
                <div className="flex items-center gap-2">
                  {d.recommendation ? (
                    <span className={cn('text-[10px] px-2 py-0.5 rounded-md font-medium', recColors[d.recommendation as string] || 'bg-bg-tertiary text-text-muted')}>
                      {d.recommendation as string}
                    </span>
                  ) : null}
                  {d.masterBug && d.recommendation === 'Link as Duplicate' ? (
                    <span className="text-[10px] text-text-muted">Master: <span className="font-mono">{d.masterBug as string}</span></span>
                  ) : null}
                </div>

                {/* Difference explanation */}
                {d.difference && d.difference !== 'null' ? (
                  <p className="text-[10px] text-text-muted mt-1">{d.difference as string}</p>
                ) : null}

                {/* Fallback: old-format reason */}
                {!d.recommendation && d.reason ? (
                  <p className="text-xs text-text-secondary mt-1">{d.reason as string}</p>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {/* Bug Clusters */}
      {clusters.length > 0 && (
        <div className="glass-panel p-6">
          <div className="flex items-center gap-2 mb-3">
            <GitCompare className="w-4 h-4 text-accent-violet" />
            <span className="text-sm font-semibold text-accent-violet">Related Bug Clusters</span>
          </div>
          {clusters.map((c, i) => (
            <div key={i} className="p-3 rounded-xl bg-accent-violet/5 border border-accent-violet/10 mb-2 last:mb-0">
              <p className="text-sm text-text-primary font-medium">{c.name as string}</p>
              <p className="text-xs text-text-secondary mt-0.5">{c.description as string}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] text-text-muted">Bugs:</span>
                {(c.bugIds as string[])?.map((id) => (
                  <span key={id} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-bg-tertiary text-text-muted border border-border">{id}</span>
                ))}
              </div>
              {c.recommendation ? <p className="text-[10px] text-accent-violet mt-1">{c.recommendation as string}</p> : null}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
