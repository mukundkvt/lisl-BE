//For User

import { statesWithDistricts } from "../utils/State_districts.js";

// Get all states with search functionality
export const getStates = async (req, res) => {
  try {
    const { search } = req.query;
    let states = statesWithDistricts.map(({ state, state_short, state_code }) => ({
      state,
      state_short,
      state_code
    }));

    if (search) {
      const searchLower = search.toLowerCase();
      states = states.filter(state =>
        state.state.toLowerCase().includes(searchLower) ||
        state.state_short.toLowerCase().includes(searchLower)
      );
    }

    res.json(states);
  } catch (error) {
    console.error('Error in getStates:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Get districts for a specific state with search functionality
export const getDistricts = async (req, res) => {
  try {
    const { state } = req.params;
    const { search } = req.query;

    const stateData = statesWithDistricts.find(s => 
      s.state === state || s.state_short === state
    );

    if (!stateData) {
      return res.status(404).json({ message: 'State not found' });
    }

    let districts = stateData.districts;

    if (search) {
      const searchLower = search.toLowerCase();
      districts = districts.filter(district =>
        district.toLowerCase().includes(searchLower)
      );
    }

    res.json(districts);
  } catch (error) {
    console.error('Error in getDistricts:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};