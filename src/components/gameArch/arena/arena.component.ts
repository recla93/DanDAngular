import { Component, OnInit, OnDestroy, ChangeDetectorRef, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { CombatClientService } from '../../../services/combat-client.service'; // Assicurati che il percorso sia corretto
import { GameStateDto, PgDto, MonsterDto, ActionRequest, ActionType, ActionDetailDto } from '../../../model/frontend-models'; // Assicurati che il percorso sia corretto

@Component({
  selector: 'app-arena',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './arena.component.html',
  styleUrls: ['./arena.component.css']
})
export class ArenaComponent implements OnInit, OnDestroy {
  @ViewChild('logEntriesContainer') private logEntriesContainer!: ElementRef;

  public gameState: GameStateDto | null = null;
  public selectedPgIds: number[] = [];
  public isLoading: boolean = true;
  public battleLog: string[] = [];
  public battleOutcome: string | null = null;
  public isPaused: boolean = false;

  public isTargetingPlayerAction: boolean = false;
  public selectedActionForTargeting: ActionDetailDto | null = null; // Contiene tutti i dettagli dell'azione selezionata
  public selectedTargets: (PgDto | MonsterDto)[] = [];
  public currentActingPg: PgDto | null = null;

  private routeSubscription: Subscription | undefined;
  private static readonly PG_IDS_KEY = 'selectedPgIds';

  constructor(
    private combatService: CombatClientService,
    public router: Router,
    private activatedRoute: ActivatedRoute,
    private cdRef: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    const storedPgIds = sessionStorage.getItem(ArenaComponent.PG_IDS_KEY);
    if (storedPgIds) {
      this.selectedPgIds = JSON.parse(storedPgIds);
      if (this.selectedPgIds && this.selectedPgIds.length > 0) {
        this.initializeBattle();
      } else {
        this.addLogEntry('Errore: ID dei personaggi non trovati. Torno alla selezione.');
        this.isLoading = false;
        this.navigateToSelection();
      }
    } else {
      this.routeSubscription = this.activatedRoute.queryParams.subscribe(params => {
        const pgIdsParam = params['pgIds'];
        if (pgIdsParam) {
          this.selectedPgIds = pgIdsParam.split(',').map((id: string) => parseInt(id, 10)).filter((id: number) => !isNaN(id));
          sessionStorage.setItem(ArenaComponent.PG_IDS_KEY, JSON.stringify(this.selectedPgIds));
          if (this.selectedPgIds && this.selectedPgIds.length > 0) {
            this.initializeBattle();
          } else {
            this.addLogEntry('Errore: ID dei personaggi non validi dai parametri URL.');
            this.isLoading = false;
            this.navigateToSelection();
          }
        } else {
          this.addLogEntry('Errore: ID dei personaggi non forniti. Navigare da /selezione.');
          this.isLoading = false;
          this.navigateToSelection();
        }
      });
    }
  }

  private initializeBattle(): void {
    this.isLoading = true;
    this.isPaused = false;
    this.battleLog = [];
    this.addLogEntry('Inizializzazione battaglia...');
    this.battleOutcome = null;
    this.resetActionState();
    this.combatService.startNewGame(this.selectedPgIds).subscribe({
      next: (initialGameState) => {
        this.gameState = this.processIncomingGameState(initialGameState);
        this.addLogEntry('Battaglia iniziata!');
        this.isLoading = false;
        this.cdRef.detectChanges();
        this.checkIfMonsterTurn();
      },
      error: (err) => {
        this.addLogEntry(`Errore durante l'inizializzazione della battaglia: ${err.message}`);
        console.error(err);
        this.isLoading = false;
        this.cdRef.detectChanges();
      }
    });
  }

  private processIncomingGameState(newState: GameStateDto, existingState?: GameStateDto | null): GameStateDto {
    newState.good.forEach(pg => {
      const existingPg = existingState?.good.find(epg => epg.id === pg.id);
      pg.maxHp = existingPg?.maxHp || pg.hp;
      pg.currentHp = pg.hp;

      if (!pg.detailedActions) {
        console.warn(`PgDto per ${pg.name} (ID: ${pg.id}) non ha il campo 'detailedActions'. Assicurati che il backend lo invii.`);
        pg.detailedActions = [];
      } else {
        pg.detailedActions.forEach(action => {
          // Converte la stringa actionType (dal JSON) nell'enum ActionType
          const enumValue = Object.values(ActionType).find(val => val === (action.actionType as string));
          if (enumValue) {
            action.actionType = enumValue;
          } else {
            console.warn(`ActionType non valido ('${action.actionType}') per l'azione '${action.name}' del PG ${pg.name}. Default a BASE.`);
            action.actionType = ActionType.BASE; // Fallback
          }
        });
      }
    });
    newState.evil.forEach(monster => {
      const existingMonster = existingState?.evil.find(em => em.id === monster.id);
      monster.maxHp = existingMonster?.maxHp || monster.hp;
      monster.currentHp = monster.hp;
    });
    return newState;
  }

  private addLogEntry(message: string): void {
    this.battleLog.push(message);
    this.scrollToBottomLog();
  }

  private scrollToBottomLog(): void {
    try {
      setTimeout(() => {
        if (this.logEntriesContainer && this.logEntriesContainer.nativeElement) {
          this.logEntriesContainer.nativeElement.scrollTop = this.logEntriesContainer.nativeElement.scrollHeight;
        }
      }, 0);
    } catch (err) {
      console.error('Errore durante lo scroll del log:', err);
    }
  }

  public getCharacterById(id: number): PgDto | MonsterDto | undefined {
    if (!this.gameState) return undefined;
    let character = this.gameState.good.find(pg => pg.id === id);
    if (character) return character;
    return this.gameState.evil.find(m => m.id === id);
  }

  public isPlayerTurn(): boolean {
    if (!this.gameState || !this.gameState.currentEntity) return false;
    return this.gameState.good.some(pg => pg.id === this.gameState!.currentEntity);
  }

  private checkIfMonsterTurn(): void {
    if (this.isPaused || this.battleOutcome || !this.gameState) return;
    if (!this.isPlayerTurn()) {
      const monster = this.getCharacterById(this.gameState.currentEntity);
      this.addLogEntry(`È il turno di ${monster?.name || 'Mostro Sconosciuto'}. Il mostro prepara un'azione...`);
      this.cdRef.detectChanges();
      setTimeout(() => this.handleMonsterAction(), 1200);
    }
  }

  private handleMonsterAction(): void {
    if (this.isPaused || this.battleOutcome || !this.gameState || this.isPlayerTurn()) return;
    const monsterActionRequest: ActionRequest = {
      previousDto: this.gameState,
      target: [],
      actionType: ActionType.BASE
    };
    this.isLoading = true;
    this.cdRef.detectChanges();
    this.combatService.performAction(monsterActionRequest).subscribe({
      next: (updatedGameStateFromServer) => {
        const actingCharacter = this.getCharacterById(this.gameState!.currentEntity);
        const oldPgsHp = this.gameState!.good.map(pg => ({ id: pg.id, hp: pg.currentHp }));
        this.gameState = this.processIncomingGameState(updatedGameStateFromServer, this.gameState);
        this.logHpChanges(oldPgsHp, this.gameState.good, null); // Passa null per oldMonstersHp
        this.addLogEntry(`${actingCharacter?.name || 'Mostro'} ha agito.`);
        this.isLoading = false;
        this.cdRef.detectChanges();
        this.proceedToNextStep();
      },
      error: (err) => {
        this.addLogEntry(`Errore durante l'azione del mostro: ${err.message}`);
        this.isLoading = false;
        this.cdRef.detectChanges();
      }
    });
  }

  private logHpChanges(
    oldEntitiesHp: { id: number; hp: number }[],
    newEntities: (PgDto | MonsterDto)[],
    oldEnemyHpMap?: Map<number, number> | null // Aggiunto per coerenza, anche se non usato qui
  ): void {
    newEntities.forEach(newEntity => {
      const oldEntity = oldEntitiesHp.find(o => o.id === newEntity.id);
      if (oldEntity) {
        const oldHp = oldEntity.hp;
        const currentHp = newEntity.currentHp;
        if (currentHp < oldHp) {
          this.addLogEntry(`${newEntity.name} subisce ${oldHp - currentHp} danni. HP rimanenti: ${currentHp}/${newEntity.maxHp}`);
        } else if (currentHp > oldHp) {
          this.addLogEntry(`${newEntity.name} viene curato di ${currentHp - oldHp}. HP attuali: ${currentHp}/${newEntity.maxHp}`);
        }
        if (currentHp <= 0 && oldHp > 0) {
          this.addLogEntry(`${newEntity.name} è stato sconfitto!`);
        }
      }
    });
  }

  public handlePlayerActionSelection(selectedAction: ActionDetailDto, actingPg: PgDto): void {
    // Chiamato quando un giocatore clicca un pulsante azione.
    // selectedAction è l'oggetto ActionDetailDto completo.
    if (this.isPaused || this.battleOutcome || !this.gameState || !this.isPlayerTurn() || selectedAction.currentCooldown > 0) {
      if (selectedAction.currentCooldown > 0) {
        this.addLogEntry(`Azione '${selectedAction.name}' è in cooldown per altri ${selectedAction.currentCooldown} turni.`);
      }
      return;
    }

    this.selectedActionForTargeting = selectedAction; // Memorizza l'azione selezionata
    this.currentActingPg = actingPg;
    this.selectedTargets = []; // Resetta i bersagli precedenti

    console.log('[DEBUG] Azione Selezionata:', this.selectedActionForTargeting);
    console.log(`[DEBUG] targetsSelf: ${selectedAction.targetsSelf}, targetsAllies: ${selectedAction.targetsAllies}, maxTargets: ${selectedAction.maxTargets}`);

    if (selectedAction.targetsSelf) {
      // Se l'azione bersaglia solo sé stesso, non c'è bisogno di entrare in modalità targeting.
      this.isTargetingPlayerAction = false;
      this.selectedTargets = [actingPg]; // Il bersaglio è l'attore stesso
      this.addLogEntry(`${actingPg.name} usa ${selectedAction.name} su sé stesso.`);
      this.confirmPlayerAction(); // Esegui l'azione immediatamente
    } else {
      // Altrimenti, entra in modalità targeting.
      this.isTargetingPlayerAction = true;
      if (selectedAction.maxTargets > 0) {
        this.addLogEntry(`Seleziona ${selectedAction.maxTargets > 1 ? 'fino a ' : ''}${selectedAction.maxTargets} ${selectedAction.targetsAllies ? 'alleato/i' : 'nemico/i'} per ${selectedAction.name}.`);
      } else {
        // Questo caso (maxTargets <= 0 e non targetsSelf) potrebbe indicare un'azione ad area che colpisce tutti
        // i nemici o tutti gli alleati senza selezione esplicita.
        // Per ora, entriamo comunque in modalità targeting, ma potrebbe essere gestito diversamente.
        this.addLogEntry(`Azione ${selectedAction.name} selezionata. Potrebbe bersagliare tutti o richiedere una conferma senza selezione esplicita.`);
        // Se è un'azione ad area che non richiede selezione, potresti voler popolare selectedTargets qui
        // e chiamare confirmPlayerAction(), oppure il backend la gestisce basandosi solo su actionName/Type.
      }
    }
    this.cdRef.detectChanges();
  }

  public selectTarget(target: MonsterDto | PgDto): void {
    // Chiamato quando si clicca su una card personaggio/mostro durante il targeting.
    if (this.isPaused || !this.isTargetingPlayerAction || this.battleOutcome || !this.currentActingPg || !this.selectedActionForTargeting) {
      return;
    }

    const targetEntityType = this.getEntityType(target.id);
    const action = this.selectedActionForTargeting;

    // Non permettere di bersagliare entità sconfitte (a meno che non sia una resurrezione, da implementare)
    if (target.currentHp <= 0 && !action.name.toLowerCase().includes("resurrezione")) {
      this.addLogEntry(`${target.name} è sconfitto e non può essere bersagliato da questa azione.`);
      return;
    }

    const targetIndex = this.selectedTargets.findIndex(t => t.id === target.id);

    if (action.targetsAllies) {
      if (targetEntityType === 'pg') { // L'azione bersaglia alleati, e il target cliccato è un PG
        if (targetIndex > -1) { // Se il PG è già selezionato, deselezionalo
          this.selectedTargets.splice(targetIndex, 1);
          this.addLogEntry(`${target.name} deselezionato.`);
        } else { // Se il PG non è selezionato
          if (action.maxTargets === 1) { // Se l'azione è a bersaglio singolo alleato
            this.selectedTargets = [target as PgDto]; // Sostituisci la selezione corrente
            this.addLogEntry(`${this.currentActingPg.name} bersaglia ${target.name} per ${action.name}.`);
          } else if (this.selectedTargets.length < action.maxTargets) { // Se è multi-target alleato e c'è spazio
            this.selectedTargets.push(target as PgDto);
            this.addLogEntry(`${this.currentActingPg.name} aggiunge ${target.name} ai bersagli per ${action.name}.`);
          } else { // Limite massimo di bersagli alleati raggiunto
            this.addLogEntry(`Puoi selezionare al massimo ${action.maxTargets} alleato/i. Deseleziona un bersaglio per cambiarlo.`);
          }
        }
      } else { // Tentativo di bersagliare un non-PG con un'azione per alleati
        this.addLogEntry("Questa azione può bersagliare solo personaggi alleati.");
      }
    } else { // L'azione NON bersaglia alleati (quindi è offensiva, bersaglia mostri)
      if (targetEntityType === 'monster') { // E il target cliccato è un mostro
        if (targetIndex > -1) { // Se il mostro è già selezionato, deselezionalo
          this.selectedTargets.splice(targetIndex, 1);
          this.addLogEntry(`${target.name} deselezionato.`);
        } else { // Se il mostro non è selezionato
          if (action.maxTargets === 1) { // Se l'azione è a bersaglio singolo nemico
            this.selectedTargets = [target as MonsterDto]; // Sostituisci la selezione corrente
            this.addLogEntry(`${this.currentActingPg.name} bersaglia ${target.name} per ${action.name}.`);
          } else if (this.selectedTargets.length < action.maxTargets) { // Se è multi-target nemico e c'è spazio
            this.selectedTargets.push(target as MonsterDto);
            this.addLogEntry(`${this.currentActingPg.name} aggiunge ${target.name} ai bersagli per ${action.name}.`);
          } else { // Limite massimo di bersagli nemici raggiunto
            this.addLogEntry(`Puoi selezionare al massimo ${action.maxTargets} nemico/i. Deseleziona un bersaglio per cambiarlo.`);
          }
        }
      } else { // Tentativo di bersagliare un non-mostro con un'azione offensiva
        this.addLogEntry("Questa azione può bersagliare solo mostri nemici.");
      }
    }
    this.cdRef.detectChanges();
  }

  public isTargetSelected(entityId: number): boolean {
    if (!this.selectedTargets) return false;
    return this.selectedTargets.some(target => target.id === entityId);
  }

  public confirmPlayerAction(): void {
    if (this.isPaused || !this.gameState || !this.isPlayerTurn() || this.battleOutcome || !this.selectedActionForTargeting || !this.currentActingPg) {
      this.cancelTargeting();
      return;
    }

    const action = this.selectedActionForTargeting;
    // Se l'azione non è su sé stesso E richiede bersagli (maxTargets > 0) E nessun bersaglio è selezionato -> errore
    if (!action.targetsSelf && action.maxTargets > 0 && this.selectedTargets.length === 0) {
      this.addLogEntry("Devi selezionare almeno un bersaglio per questa azione.");
      this.cdRef.detectChanges();
      return;
    }

    this.addLogEntry(`${this.currentActingPg.name} usa l'azione ${action.name} (${action.actionType}) su ${this.selectedTargets.length > 0 ? this.selectedTargets.map(target => target.name).join(', ') : (action.targetsSelf ? 'sé stesso' : 'tutti i bersagli validi')}`);

    const actionRequest: ActionRequest = {
      previousDto: this.gameState,
      target: this.selectedTargets.map(target => target.id), // Invia gli ID dei bersagli selezionati
      actionType: action.actionType,
      actionName: action.name
    };

    const oldPgsHp = this.gameState.good.map(pg => ({ id: pg.id, hp: pg.currentHp }));
    const oldMonstersHp = this.gameState.evil.map(m => ({ id: m.id, hp: m.currentHp }));

    this.isLoading = true;
    this.resetActionState();
    this.cdRef.detectChanges();

    this.combatService.performAction(actionRequest).subscribe({
      next: (updatedGameStateFromServer) => {
        this.gameState = this.processIncomingGameState(updatedGameStateFromServer, this.gameState);
        this.logHpChanges(oldPgsHp, this.gameState.good, null); // Passa null per oldMonstersHp se non rilevante per questa chiamata
        this.logHpChanges(oldMonstersHp, this.gameState.evil, null); // Logica per i mostri se colpiti
        this.isLoading = false;
        this.cdRef.detectChanges();
        this.proceedToNextStep();
      },
      error: (err) => {
        this.addLogEntry(`Errore durante l'esecuzione dell'azione: ${err.message}`);
        this.isLoading = false;
        this.cdRef.detectChanges();
      }
    });
  }

  public cancelTargeting(): void {
    this.resetActionState();
    this.addLogEntry("Selezione bersaglio annullata.");
    this.cdRef.detectChanges();
  }

  private resetActionState(): void {
    this.isTargetingPlayerAction = false;
    this.selectedActionForTargeting = null;
    this.selectedTargets = [];
    this.currentActingPg = null;
  }

  public getSelectedTargetNames(): string {
    return this.selectedTargets.map(target => target.name).join(', ');
  }

  private proceedToNextStep(): void {
    if (this.isPaused || !this.gameState || this.battleOutcome) {
      this.isLoading = false;
      this.cdRef.detectChanges();
      return;
    }
    this.combatService.checkBattleOver(this.gameState).subscribe({
      next: (outcome) => {
        if (outcome !== "La battaglia è ancora in corso") {
          this.battleOutcome = outcome;
          this.addLogEntry(outcome);
          this.isLoading = false;
          sessionStorage.removeItem(ArenaComponent.PG_IDS_KEY);
        } else {
          this.advanceTurn();
        }
        this.cdRef.detectChanges();
      },
      error: (err) => {
        this.addLogEntry(`Errore nel controllare la fine della battaglia: ${err.message}`);
        this.isLoading = false;
        this.cdRef.detectChanges();
      }
    });
  }

  private advanceTurn(): void {
    if (this.isPaused || !this.gameState || this.battleOutcome) return;
    this.isLoading = true;
    this.cdRef.detectChanges();
    this.combatService.advanceToNextEntity(this.gameState).subscribe({
      next: (nextStateFromServer) => {
        this.gameState = this.processIncomingGameState(nextStateFromServer, this.gameState);
        const nextChar = this.getCharacterById(this.gameState.currentEntity);
        this.addLogEntry(`Prossimo turno: ${nextChar?.name || 'Sconosciuto'}`);
        this.isLoading = false;
        this.cdRef.detectChanges();
        this.checkIfMonsterTurn();
      },
      error: (err) => {
        this.addLogEntry(`Errore nell'avanzare il turno: ${err.message}`);
        this.isLoading = false;
        this.cdRef.detectChanges();
      }
    });
  }

  public getEntityType(entityId: number): 'pg' | 'monster' | 'unknown' {
    if (!this.gameState) return 'unknown';
    if (this.gameState.good.some(pg => pg.id === entityId)) return 'pg';
    if (this.gameState.evil.some(m => m.id === entityId)) return 'monster';
    return 'unknown';
  }

  public navigateToHome(): void {
    this.router.navigate(['/']);
  }

  public navigateToSelection(): void {
    this.router.navigate(['/selezione']);
  }

  public togglePauseMenu(): void {
    if (this.battleOutcome) return;
    this.isPaused = !this.isPaused;
    if (this.isPaused) {
      this.addLogEntry("Partita in pausa.");
      this.cancelTargeting();
    } else {
      this.addLogEntry("Partita ripresa.");
      this.checkIfMonsterTurn();
    }
    this.cdRef.detectChanges();
  }

  public startNewGameFromPause(): void {
    this.isPaused = false;
    sessionStorage.removeItem(ArenaComponent.PG_IDS_KEY);
    this.navigateToSelection();
  }

  public navigateToHomeFromPause(): void {
    this.isPaused = false;
    sessionStorage.removeItem(ArenaComponent.PG_IDS_KEY);
    this.navigateToHome();
  }

  ngOnDestroy(): void {
    if (this.routeSubscription) {
      this.routeSubscription.unsubscribe();
    }
  }
}
