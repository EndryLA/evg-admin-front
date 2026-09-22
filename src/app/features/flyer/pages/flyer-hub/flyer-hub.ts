import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * "Génération de flyers" landing page (`/flyers`): a directory of the flyers the
 * department can produce. Each card links to its generator. New flyer types are
 * added here as they are built.
 */
@Component({
  selector: 'app-flyer-hub',
  imports: [RouterLink],
  templateUrl: './flyer-hub.html',
  styleUrl: './flyer-hub.scss',
})
export class FlyerHub {}
