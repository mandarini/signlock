import { Component, OnInit, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import * as tf from '@tensorflow/tfjs';

@Component({
  selector: 'app-controls',
  templateUrl: './controls.component.html',
  styleUrls: ['./controls.component.scss']
})
export class ControlsComponent implements AfterViewInit {
  
  CONTROLS: Array<string> = ['up', 'down', 'left', 'right'];
  CONTROL_CODES: Array<number> = [38, 40, 37, 39];

  @ViewChild('controller') controller: ElementRef;
  @ViewChild('trainStatus') trainStatus: ElementRef;
  @ViewChild('learningRate') learningRate: ElementRef;
  @ViewChild('batchSizeFraction') batchSizeFraction: ElementRef;
  @ViewChild('epochs') epochs: ElementRef;
  @ViewChild('denseUnits') denseUnits: ElementRef;
  @ViewChild('status') status: ElementRef;

  constructor() { }

  ngAfterViewInit() {
  }

}
