import type { ThemeComponents } from '../types';
import Base from './Base.astro';
import Nav from './Nav.astro';
import Hero from './Hero.astro';
import Film from './Film.astro';
import Offers from './Offers.astro';
import Athletics from './Athletics.astro';
import Positions from './Positions.astro';
import Academics from './Academics.astro';
import Schedule from './Schedule.astro';
import Contact from './Contact.astro';
import Footer from './Footer.astro';

export const bareTheme: ThemeComponents = {
  Base, Nav, Hero, Film, Offers, Athletics, Positions, Academics, Schedule, Contact, Footer,
};
