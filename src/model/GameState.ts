import {Pg} from "./Pg";
import {Monster} from './Monster';


export interface GameState
{
  good : Pg[];
  evil : Monster[];
  order : number[];
  currentEntity : number;
}
