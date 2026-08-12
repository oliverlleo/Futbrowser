import { CareerMatchEngine } from './career-match-engine-v2.js?v=20260811-1';

if (!CareerMatchEngine.prototype.__competitionWorkloadPatch) {
  CareerMatchEngine.prototype.__competitionWorkloadPatch = true;

  const originalStart = CareerMatchEngine.prototype.start;
  const originalChoose = CareerMatchEngine.prototype.choose;
  const originalResult = CareerMatchEngine.prototype.result;

  CareerMatchEngine.prototype.start = function patchedWorkloadStart(...args) {
    this.playerStats.high_intensity_actions = Number(this.playerStats.high_intensity_actions || 0);
    this.playerStats.physical_actions = Number(this.playerStats.physical_actions || 0);
    this.playerStats.sprints = Number(this.playerStats.sprints || 0);
    this.playerStats.pressures = Number(this.playerStats.pressures || 0);
    this.playerStats.tackles_attempted = Number(this.playerStats.tackles_attempted || 0);
    return originalStart.apply(this, args);
  };

  CareerMatchEngine.prototype.choose = function patchedWorkloadChoose(key) {
    const choice = this.pendingDecision?.options?.find(option => option.key === key);
    if (choice && this.playerStats) {
      const tags = new Set(choice.tags || []);
      const energyCost = Math.max(0, Number(choice.cost || 0));
      const intense = ['sprint', 'press', 'run', 'tackle', 'dribble'].some(tag => tags.has(tag));
      const physical = ['sprint', 'press', 'run', 'tackle', 'dribble', 'duel', 'defend', 'aerial'].some(tag => tags.has(tag));
      if (intense) this.playerStats.high_intensity_actions += 1 + (energyCost >= 8 ? 1 : 0);
      if (physical) this.playerStats.physical_actions += 1;
      if (tags.has('sprint') || (tags.has('run') && energyCost >= 7)) this.playerStats.sprints += 1;
      if (tags.has('press')) this.playerStats.pressures += 1;
      if (tags.has('tackle')) this.playerStats.tackles_attempted += 1;
    }
    return originalChoose.call(this, key);
  };

  CareerMatchEngine.prototype.result = function patchedWorkloadResult(...args) {
    const result = originalResult.apply(this, args);
    if (result?.playerStats) {
      result.playerStats.end_match_energy = this.user?.energy == null ? null : Math.round(this.user.energy);
      result.playerStats.start_match_energy = this.context?.state?.energy == null ? null : Number(this.context.state.energy);
      result.playerStats.match_tempo = Number(this.teamTactics?.home?.tempo || 50);
      result.playerStats.minutes = Number(result.playerStats.minutes || 0);
    }
    return result;
  };
}
