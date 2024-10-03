# Smorrery: a simple orrery app

![](https://imgur.com/ECB6ciw.png)

## Description

1. The **index page** offers a streamlined interface for viewing [Near-Earth Object](https://en.wikipedia.org/wiki/Near-Earth_object) (NEO) data retrieved from NASA's SBDB API.
2. The **orrery web app** simulates the orbital motion of the eight planets in our solar system from 1900 to 2100. Users can adjust the simulation speed via a control panel and toggle visual elements such as orbits, labels, and axes for enhanced viewing. 

## Usage

1. Create a Python virtual environment and install the packages listed in `requirements.txt`.
2. Run `flask run` in shell to launch the Flask development server locally.
3. Open a browser and access the index page at `http://127.0.0.1:5000/`.
4. Access the orrery web app at `http://127.0.0.1:5000/orrery`.

## New features (2024-10-04)

- **Celestial Lab — Create an asteroid!**. 
    1. Input the mass, initial position and velocity, and give it a name.
    2. Launch your asteroid!
    3. Draw auxiliary visual objects, such as specific , eccentricity vectors
- *Caution! Coordinate transformation problems. (To be fixed)*
- Fixed Saturn's ring texture problem.

## New features (2024-09-30)

- Render the traces of 20 NEOs.
- Add textures for the Sun and planets.
- Include a starry sky background with Milky Way.
- Add rings of Saturn (~~texture mapping has an issue, temporarily replaced with a white color~~)
- Hovering over celestial objects with the mouse triggers a green glow
- Clicking on the mesh or label of a celestial object displays its information, currently printed in the console

## Future work

- Add a dropdown menu containing checkboxes to toggle the display of different types of celestial objects (such as the Sun, planets, [NEOs](https://en.wikipedia.org/wiki/Near-Earth_object), [PHAs](https://en.wikipedia.org/wiki/Potentially_hazardous_object), other asteroids, etc.)
- Compare calculated planetary positions with [ephemerides](https://ssd.jpl.nasa.gov/planets/eph_export.html) for accuracy.
- Add an "impact risk" view that visualizes and emphasizes the proximity of Earth's orbit and some NEOs' orbits.
- Add more educational canvases that can be used to teach concepts such as Kepler's laws or the Sun-Earth–Moon system.
- Add planetary axial tilt and rotation, with special emphasis on Earth.
- Add the Moon 🌙 and more moons.

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
