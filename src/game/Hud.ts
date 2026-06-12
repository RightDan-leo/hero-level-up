import { ARMY, CTA } from '../config/gameConfig';
import { Sfx } from './sfx';

/** DOM 叠加层 HUD：战力/兵数显示、提示、横幅、CTA。 */
export class Hud {
  private root: HTMLDivElement;
  private powerEl: HTMLDivElement;
  private hintEl: HTMLDivElement;
  private bannerEl: HTMLDivElement;
  private ctaEl: HTMLDivElement;
  private bannerTimer = 0;

  constructor(container: HTMLElement, onRestart: () => void) {
    this.root = document.createElement('div');
    this.root.className = 'hud';

    this.powerEl = document.createElement('div');
    this.powerEl.className = 'hud-power';
    this.root.appendChild(this.powerEl);

    this.hintEl = document.createElement('div');
    this.hintEl.className = 'hud-hint';
    this.root.appendChild(this.hintEl);

    this.bannerEl = document.createElement('div');
    this.bannerEl.className = 'hud-banner';
    this.root.appendChild(this.bannerEl);

    const mute = document.createElement('button');
    mute.className = 'hud-mute';
    mute.textContent = '🔊';
    mute.addEventListener('click', (e) => {
      e.stopPropagation();
      const m = !Sfx.isMuted();
      Sfx.setMuted(m);
      mute.textContent = m ? '🔇' : '🔊';
    });
    this.root.appendChild(mute);

    this.ctaEl = document.createElement('div');
    this.ctaEl.className = 'cta';
    this.root.appendChild(this.ctaEl);

    container.appendChild(this.root);
    this.onRestart = onRestart;
  }

  private onRestart: () => void;

  setPower(power: number, soldiers: number, tierIdx: number): void {
    const tier = ARMY.tierNames[tierIdx] ?? ARMY.tierNames[ARMY.tierNames.length - 1];
    this.powerEl.innerHTML = `⚔ 战力 ${Math.round(power)} · 士兵 x${soldiers}<br><span class="tier">兵种：${tier}</span>`;
  }

  setHint(text: string): void {
    this.hintEl.style.display = text ? 'block' : 'none';
    this.hintEl.textContent = text;
  }

  banner(text: string, ms = 1400): void {
    this.bannerEl.innerHTML = text;
    this.bannerEl.classList.add('show');
    clearTimeout(this.bannerTimer);
    this.bannerTimer = window.setTimeout(() => this.bannerEl.classList.remove('show'), ms);
  }

  showCTA(power: number, soldiers: number): void {
    this.setHint('');
    this.ctaEl.innerHTML = `
      <div class="cta-title">${CTA.title}</div>
      <div class="cta-stat">最终战力 ${Math.round(power)} · 麾下士兵 x${soldiers}</div>
      <div class="cta-tagline">${CTA.tagline}</div>
      <button class="cta-download">⬇ 立即下载</button>
      <button class="cta-restart">重新开始</button>
    `;
    this.ctaEl.classList.add('show');
    this.ctaEl.querySelector<HTMLButtonElement>('.cta-download')!.addEventListener('click', (e) => {
      e.stopPropagation();
      window.open(CTA.storeUrl, '_blank');
    });
    this.ctaEl.querySelector<HTMLButtonElement>('.cta-restart')!.addEventListener('click', (e) => {
      e.stopPropagation();
      this.onRestart();
    });
  }

  hideCTA(): void {
    this.ctaEl.classList.remove('show');
    this.ctaEl.innerHTML = '';
  }
}
