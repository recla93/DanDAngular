import { Component } from '@angular/core';
import {Pg} from '../../../model/Pg';

@Component({
  selector: 'app-glossary',
  imports: [],
  templateUrl: './glossary.component.html',
  styleUrl: './glossary.component.css'
})
export class GlossaryComponent
{
  personaggi: Pg[] = [];

  constructor(private pgRepo:Pg) {
  }
}
