import { Component, OnInit } from '@angular/core';
import { GameStateService } from '../../../services/game-state.service';
import { Pg } from '../../../model/Pg';
import { GameState } from '../../../model/GameState';
import { Monster } from '../../../model/Monster';
import { NgClass, NgForOf, NgIf } from '@angular/common';
import { ActionRepositoryService } from '../../../services/action-repository';
import { Actions } from '../../../model/Actions';


@Component({
  selector: 'app-combat',
  templateUrl: './combat.component.html',
  imports: [
    NgClass,
    NgForOf,
    NgIf
  ],
  styleUrls: ['./combat.component.css']
})
export class CombatComponent implements OnInit {
  pgsWithMaxHp: PgWithMaxHp[] = [];
  monstersWithMaxHp: MonsterWithMaxHp[] = []; // Aggiungi l'array per i mostri
  battleInProgress: boolean = false; // Variabile per determinare se la battaglia è in corso
  battleLog: string = ''; // Variabile per il log della battaglia

  actions: Actions[] = [];
  activePgId: number | null = null;

  constructor(
    private gameStateService: GameStateService,
    private actionRepo: ActionRepositoryService
  ) {}

  ngOnInit(): void {
    this.loadGameState(); // carica inizialmente

    // Ricarica i dati ogni 2 secondi per simulare aggiornamenti del backend
    setInterval(() => {
      this.loadGameState();
      this.checkBattleStatus();
    }, 2000);
  }

  loadGameState(): void {
    const state: GameState | null = this.gameStateService.gameState;

    if (state?.good) {
      this.activePgId = state.currentEntity;

      this.actionRepo.getActionByPgId(this.activePgId).subscribe({
        next: (actions) => {
          this.actions = actions;
        },
        error: (err) => {
          console.error('Errore nel caricamento delle azioni:', err);
        }
      });
    } else {
      this.activePgId = null;
      this.actions = [];
    }


    if (state?.evil) {
      this.monstersWithMaxHp = state.evil.map(monster => {
        const existing = this.monstersWithMaxHp.find(m => m.id === monster.id);
        return {
          ...monster,
          maxHp: existing?.maxHp || monster.hp
        };
      });
    }
    this.startBattle();
  }


  // Avvia la battaglia
  startBattle(): void {
    this.battleInProgress = true;
    this.battleLog = 'La battaglia è iniziata!';
    //this.updateBattleLog('Il PG attacca il mostro!');
  }

  // Metodo per aggiornare il log della battaglia
  updateBattleLog(message: string): void {
    this.battleLog = message;
  }

  // Metodo per calcolare la percentuale di HP di un PG
  getHpPercent(pg: PgWithMaxHp): number {
    return (pg.hp / pg.maxHp) * 100;
  }

  // Metodo per calcolare la percentuale di HP di un mostro
  getMonsterHpPercent(monster: MonsterWithMaxHp): number {
    return (monster.hp / monster.maxHp) * 100;
  }

  // Metodo per verificare se la battaglia è finita
  checkBattleStatus(): void {
    const allMonstersDead = this.monstersWithMaxHp.every(monster => monster.hp <= 0);
    const allPgsDead = this.pgsWithMaxHp.every(pg => pg.hp <= 0);

    if (allMonstersDead) {
      this.battleLog = 'I mostri sono stati sconfitti! I PG hanno vinto!';
      this.battleInProgress = false;
    } else if (allPgsDead) {
      this.battleLog = 'Tutti i PG sono stati sconfitti! I mostri hanno vinto!';
      this.battleInProgress = false;
    }
  }

}



interface PgWithMaxHp extends Pg {
  maxHp: number;
}

interface MonsterWithMaxHp extends Monster {
  maxHp: number;
}


// 1. far comparire le mosse se è il turno del pg o un bottone se è il turno del mostro
// tali bottoni faranno una request al backend per far avanzare il gamestate che poi verrà usato per aggiornare lo stato di gameservice
