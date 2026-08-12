import { CareerMatchEngine, narrate } from './career-match-engine-v2.js?v=20260811-1';
import { applyRoleFormation, resolveFormationKey } from './career-match-engine-v3.js?v=20260811-1';

if (!CareerMatchEngine.prototype.__roleFormationPatched) {
  const originalStart = CareerMatchEngine.prototype.start;

  CareerMatchEngine.prototype.start = function patchedMatchStart() {
    this.homeFormation = resolveFormationKey(this.context.home?.formation || this.context.club?.formation);
    this.awayFormation = resolveFormationKey(this.context.away?.formation || this.context.opponent?.formation);
    applyRoleFormation(this.home, this.homeFormation, true);
    applyRoleFormation(this.away, this.awayFormation, false);
    if (this.user) this.user = this.home.find(player => player.isUser) || this.user;
    this.directOpponent = this.resolveDirectOpponent();
    return originalStart.call(this);
  };

  CareerMatchEngine.prototype.startSecondHalf = function patchedSecondHalf() {
    if (this.phase !== 'halftime') return;
    this.homeAttacksRight = !this.homeAttacksRight;
    this.phase = 'second';
    applyRoleFormation(this.home, this.homeFormation || resolveFormationKey(this.context.home?.formation || this.context.club?.formation), this.homeAttacksRight);
    applyRoleFormation(this.away, this.awayFormation || resolveFormationKey(this.context.away?.formation || this.context.opponent?.formation), !this.homeAttacksRight);
    if (this.user) this.user = this.home.find(player => player.isUser) || this.user;
    this.minute = 45;
    this.second = 0;
    this.paused = false;
    this.feed(narrate('restart', {}, this.rng), 'restart');
    this.emit('sidechange', this.snapshot());
  };

  Object.defineProperty(CareerMatchEngine.prototype, '__roleFormationPatched', {
    value: true,
    enumerable: false,
    configurable: false
  });
}
