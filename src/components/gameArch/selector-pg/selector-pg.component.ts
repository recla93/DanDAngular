import { Component } from '@angular/core';
import {Pg} from '../../../model/Pg';
import {PgRepositoryService} from '../../../services/pg-repository.service';
import {NgForOf} from '@angular/common';
import { GameStateService } from '../../../services/game-state.service';
import { Router } from '@angular/router';


@Component({
  selector: 'app-selector-pg',
  imports: [
    NgForOf
  ],

  templateUrl: './selector-pg.component.html',
  styleUrl: './selector-pg.component.css'
})
export class SelectorPgComponent
{
  allCharacters: Pg[] = [];
  idSelectedCharacter: number[] = []

  constructor
  (
    private pgRepo: PgRepositoryService,
    private gameStateService: GameStateService,
    private router: Router
  ) {}

  ngOnInit()
  {
    this.pgRepo.getAllPgs()
      .subscribe({
        next: (data) => {
          this.allCharacters = data;
        },
        error: (err) => {
          console.log("Errore caricamento personaggi:", err);
          this.allCharacters = [];
        },
      })
  }

  selectionChange(id: number): void {
    const index = this.idSelectedCharacter.indexOf(id);

    if (index > -1) {
      // già selezionato → deseleziona
      this.idSelectedCharacter.splice(index, 1);
    } else if (this.idSelectedCharacter.length < 3) {
      // ancora spazio → seleziona
      this.idSelectedCharacter.push(id);
    }
  }

  get selectedNames(): string {
    return this.allCharacters
      .filter(c => this.idSelectedCharacter.includes(c.id))
      .map(c => c.name)
      .join(', ') || 'Nessuno';
  }

  startGame(): void {
    if (this.idSelectedCharacter.length === 3) {
      this.gameStateService.iniziaGame(this.idSelectedCharacter)
        .subscribe({
          next: (resp) => {
            console.log("GameState ricevuto:", resp);
            this.gameStateService.gameState = resp;
            this.router.navigate(['/combat']);
          },
          error: (err) => {
            console.error("Errore durante l'avvio della partita:", err);
            alert("Errore durante l'avvio della partita. Riprova.");
          }
        });
    }
  }

}

