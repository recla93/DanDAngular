import { Component } from '@angular/core';
import {Pg} from '../../../model/Pg';
import {PgRepositoryService} from '../../../services/pg-repository.service';

@Component({
  selector: 'app-selector-pg',
  imports: [],
  templateUrl: './selector-pg.component.html',
  styleUrl: './selector-pg.component.css'
})
export class SelectorPgComponent
{
  allCharacters: Pg[] = [];
  idSelectedCharacter: number[] = []

  constructor(private pgRepo:PgRepositoryService) {}

  ngOnInit()
  {
    this.pgRepo.getAllPgs()
      .subscribe({
        next: (data) => {
          this.allCharacters = data;
        },
        error: (err) => {
          this.allCharacters = [];
        },
      })
  }

  selectionChange(id: number, event: Event): void {
    const isChecked = (event.target as HTMLInputElement).checked;

    if (isChecked)
    {
      // Se è selezionato e non è già presente, aggiungilo
      if (!this.idSelectedCharacter.includes(id))
      {
        this.idSelectedCharacter.push(id);
      }
      // Se è selezionato MA è GIA' presente, non facciamo nulla
    }
    else // Se è selezionato, nel caso si voglia deselezionare un personaggio selezionato
    {
      const index = this.idSelectedCharacter.indexOf(id);
      // Se l'elemento è stato trovato, rimuovilo
      if (index > -1)
      {
        this.idSelectedCharacter.splice(index, 1);
      }
    }
  }
}
