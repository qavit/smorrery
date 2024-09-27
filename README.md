# Smorrery: for NEO Orrery

## Description

1. The **index page** offers a streamlined interface for viewing [Near-Earth Object](https://en.wikipedia.org/wiki/Near-Earth_object) (NEO) data retrieved from NASA's SBDB API.
2. The **orrery web app** simulates the orbital motion of the eight planets in our solar system from 1900 to 2100. Users can adjust the simulation speed via a control panel and toggle visual elements such as orbits, labels, and axes for enhanced viewing. 

## Usage

1. Create a Python virtual environment and install the packages listed in `requirements.txt`.
2. Run `flask run` in shell to launch the Flask development server locally.
3. Open a browser and access the index page at `http://127.0.0.1:5000/`.
4. Access the orrery web app at `http://127.0.0.1:5000/orrery`.

## Future work

- Load data for small bodies, esp. [NEOs](https://en.wikipedia.org/wiki/Near-Earth_object) and [PHAs](https://en.wikipedia.org/wiki/Potentially_hazardous_object).
- Add detailed features to the Sun and the planets.
- Compare calculated planetary positions with [ephemerides](https://ssd.jpl.nasa.gov/planets/eph_export.html) for accuracy.
- Incorporate additional visual reference elements.

## References
- Orbital mechanics
    - [*Approximate Positions of the Planets*](https://ssd.jpl.nasa.gov/planets/approx_pos.html) provides the Keplerian elements of the 8 planets and some useful formulae.


    - Domain knowledge: 
        - [**orbital mechanics**](https://en.wikipedia.org/wiki/Orbital_mechanics)
        - [**orbital elements**](https://en.wikipedia.org/wiki/Orbital_elements)
        - [**Kepler's equation**](https://en.wikipedia.org/wiki/Kepler%27s_equation)
        - [**epoch**](https://en.wikipedia.org/wiki/Epoch_(astronomy))
        - [**ephemeris**](https://en.wikipedia.org/wiki/Ephemeris#Modern_ephemeris)

- APIs
    - [NASA SBDB Query API](https://ssd-api.jpl.nasa.gov/sbdb_query.api)  — API
    - [NASA SBDB Query API](https://ssd-api.jpl.nasa.gov/doc/sbdb_query.html) — document, description about the parameters
    - [NASA Small-Body Database Query](https://ssd.jpl.nasa.gov/tools/sbdb_query.html) — GUI tool 
    - [Lance798/orrery-app-backend](https://github.com/Lance798/orrery-app-backend) — teammate's work

- i18n & l10n with Flask
    - [The Flask Mega-Tutorial, Part XIII: I18n and L10n](https://blog.miguelgrinberg.com/post/the-flask-mega-tutorial-part-xiii-i18n-and-l10n)
    - [Flask實作_開始建置頁面內容_15_加入多語系](https://hackmd.io/@shaoeChen/Sydgiqsz7?type=view)
    - [Flask實作_ext_17_Flask_babel_多語系](https://hackmd.io/@shaoeChen/SyX5xZWz7?type=view)
