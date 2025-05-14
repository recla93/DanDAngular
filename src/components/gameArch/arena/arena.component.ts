import { Component, OnInit, OnDestroy, ChangeDetectorRef, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { CombatClientService } from '../../../services/combat-client.service';
import { GameStateDto, PgDto, MonsterDto, ActionRequest, ActionType } from '../../../model/frontend-models';

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
  public selectedActionNameForTargeting: string | null = null;
  public selectedActionTypeForTargeting: ActionType | null = null;
  public selectedTargets: (PgDto | MonsterDto)[] = [];
  public selectedActionRequiresTarget: boolean = true;
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

        this.logHpChanges(oldPgsHp, this.gameState.good);
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
    newEntities: (PgDto | MonsterDto)[]
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

  public handlePlayerActionSelection(actionName: string, actingPg: PgDto): void {
    if (this.isPaused || this.battleOutcome || !this.gameState || !this.isPlayerTurn()) return;
    console.log(actionName)
    console.log(actingPg)
    this.selectedActionNameForTargeting = actionName;
    this.currentActingPg = actingPg;

    const actionIndex = actingPg.actionsName.indexOf(actionName);

    console.log(actingPg.actionTypes)
    if (actionIndex !== -1 && actingPg.actionTypes && actingPg.actionTypes[actionIndex] !== undefined) {
      // Prendi il valore stringa dal backend
      const backendActionTypeString = actingPg.actionTypes[actionIndex] as string;

      // Valida se questa stringa è un membro valido del nostro enum ActionType
      let azionePresente= false
      for(let a in ActionType)
        if(a==actingPg.actionTypes[actionIndex])
          azionePresente=true;


      console.log(backendActionTypeString)
      if (azionePresente) {
        this.selectedActionTypeForTargeting = backendActionTypeString as ActionType;
      } else {
        this.addLogEntry(`Valore ActionType ('${backendActionTypeString}') dal backend per '${actionName}' non è un ActionType enum valido. Uso BASE di default.`);
        this.selectedActionTypeForTargeting = ActionType.BASE;
      }
    } else {
      this.addLogEntry(`ActionType non trovato per '${actionName}' (indice: ${actionIndex}) o backend non ha fornito actionTypes. Uso BASE di default.`);
      if (actingPg.actionTypes) {
        console.warn('actingPg.actionTypes ricevuto:', JSON.stringify(actingPg.actionTypes));
      } else {
        console.warn('actingPg.actionTypes è undefined.');
      }
      this.selectedActionTypeForTargeting = ActionType.BASE;
    }

    this.selectedActionRequiresTarget = !(this.selectedActionTypeForTargeting === ActionType.SPECIALE && actingPg.enumType === 'GITBARD' && !this.actionTargetsAllies(this.selectedActionTypeForTargeting));

    if (this.actionTargetsSelf(this.selectedActionTypeForTargeting, actingPg)) {
      this.isTargetingPlayerAction = false;
      this.selectedActionRequiresTarget = false;
      this.selectedTargets = [actingPg];
      this.confirmPlayerAction();
    } else {
      this.isTargetingPlayerAction = true;
    }
    this.cdRef.detectChanges();
  }

  private actionTargetsSelf(actionType: ActionType | null, player: PgDto): boolean {
    return false;
  }
  private actionTargetsAllies(actionType: ActionType | null): boolean {
    return false;
  }

  public selectTarget(target: MonsterDto | PgDto): void {
    if (this.isPaused || !this.isTargetingPlayerAction || this.battleOutcome) return;

    const index = this.selectedTargets.findIndex(t => t.id === target.id);
    if (index > -1) {
      this.selectedTargets.splice(index, 1);
    } else {
      if (this.selectedActionTypeForTargeting === ActionType.SPECIALE && this.currentActingPg?.enumType === 'GITBARD') {
        if (this.getEntityType(target.id) === 'pg') {
          this.selectedTargets = [target];
        } else {
          this.addLogEntry("Il Gitbard può curare solo i PG con l'azione speciale.");
          return;
        }
      } else if (this.getEntityType(target.id) === 'monster') {
        this.selectedTargets = [target];
      } else if (this.getEntityType(target.id) === 'pg' && this.currentActingPg?.id !== target.id && this.selectedActionTypeForTargeting !== ActionType.SPECIALE) {
        this.addLogEntry("Non puoi bersagliare un alleato con questa azione offensiva.");
        return;
      } else if (this.getEntityType(target.id) === 'pg' && this.currentActingPg?.id === target.id && this.selectedActionTypeForTargeting !== ActionType.SPECIALE) {
        this.addLogEntry("Non puoi auto-bersagliarti con un attacco standard.");
        return;
      }
    }
    this.cdRef.detectChanges();
  }

  public confirmPlayerAction(): void {
    if (this.isPaused || !this.gameState || !this.isPlayerTurn() || this.battleOutcome || !this.selectedActionTypeForTargeting || !this.currentActingPg) {
      this.cancelTargeting();
      return;
    }

    if (this.selectedActionRequiresTarget && this.selectedTargets.length === 0) {
      this.addLogEntry("Devi selezionare almeno un bersaglio per questa azione.");
      this.cdRef.detectChanges();
      return;
    }

    this.addLogEntry(`${this.currentActingPg.name} usa l'azione ${this.selectedActionNameForTargeting} (${this.selectedActionTypeForTargeting}) su ${this.selectedTargets.map(t => t.name).join(', ')}`);

    const actionRequest: ActionRequest = {
      previousDto: this.gameState,
      target: this.selectedTargets.map(t => t.id),
      actionType: this.selectedActionTypeForTargeting
    };

    const oldPgsHp = this.gameState.good.map(pg => ({ id: pg.id, hp: pg.currentHp }));
    const oldMonstersHp = this.gameState.evil.map(m => ({ id: m.id, hp: m.currentHp }));

    this.isLoading = true;
    this.resetActionState();
    this.cdRef.detectChanges();

    this.combatService.performAction(actionRequest).subscribe({
      next: (updatedGameStateFromServer) => {
        this.gameState = this.processIncomingGameState(updatedGameStateFromServer, this.gameState);
        this.logHpChanges(oldPgsHp, this.gameState.good);
        this.logHpChanges(oldMonstersHp, this.gameState.evil);
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
    this.cdRef.detectChanges();
  }

  private resetActionState(): void {
    this.isTargetingPlayerAction = false;
    this.selectedActionNameForTargeting = null;
    this.selectedActionTypeForTargeting = null;
    this.selectedTargets = [];
    this.currentActingPg = null;
    this.selectedActionRequiresTarget = true;
  }

  public getSelectedTargetNames(): string {
    return this.selectedTargets.map(t => t.name).join(', ');
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
