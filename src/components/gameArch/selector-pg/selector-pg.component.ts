import { Component } from '@angular/core';
import { Pg } from '../../../model/Pg';
import { PgRepositoryService } from '../../../services/pg-repository.service';
import { NgForOf } from '@angular/common';
import {map} from 'rxjs';
import {join} from '@angular/compiler-cli';

@Component({
  selector: 'app-selector-pg',
  standalone: true,
  imports: [NgForOf],
  templateUrl: './selector-pg.component.html',
  styleUrl: './selector-pg.component.css'
})
export class SelectorPgComponent {
  allCharacters: Pg[] = [];
  idSelectedCharacter: number[] = [];

  constructor(private pgRepo: PgRepositoryService) {}

  ngOnInit() {
    this.pgRepo.getAllPgs().subscribe({
      next: (data) => {
        this.allCharacters = data;
      },
      error: (err) => {
        console.log('Errore caricamento personaggi:', err);
        this.allCharacters = [];
      },
    });
  }

  selectionChange(id: number): void {
    const index = this.idSelectedCharacter.indexOf(id);
    if (index > -1) {
      this.idSelectedCharacter.splice(index, 1);
    } else if (this.idSelectedCharacter.length < 3) {
      this.idSelectedCharacter.push(id);
    }
  }

  isSelected(id: number): boolean {
    return this.idSelectedCharacter.includes(id);
  }

  get selectedNames(): string {
    return this.allCharacters
      .filter(c => this.idSelectedCharacter.includes(c.id))
      .map(c => c.name)
      .join(', ') || 'Nessuno';
  }

  protected readonly map = map;
  protected readonly join = join;
}


