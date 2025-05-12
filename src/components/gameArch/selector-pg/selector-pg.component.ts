import { Component } from '@angular/core';
import {Pg} from '../../../model/Pg';

@Component({
  selector: 'app-selector-pg',
  imports: [],
  templateUrl: './selector-pg.component.html',
  styleUrl: './selector-pg.component.css'
})
export class SelectorPgComponent {

  pgs:Pg[]=[];

}
