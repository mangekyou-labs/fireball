import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { tradingSimulatorService } from '@/services/tradingSimulator';

interface SimulationContextType {
    isSimulationMode: boolean;
    toggleSimulationMode: () => void;
    apiKey: string;
    setApiKey: (key: string) => void;
    serverUrl: string;
    setServerUrl: (url: string) => void;
    simulatorTeamName: string;
    setSimulatorTeamName: (name: string) => void;
    connectToSimulator: () => Promise<boolean>;
    disconnectFromSimulator: () => void;
    isConnected: boolean;
}

const defaultContext: SimulationContextType = {
    isSimulationMode: false,
    toggleSimulationMode: () => { },
    apiKey: '',
    setApiKey: () => { },
    serverUrl: 'http://localhost:3000/api',
    setServerUrl: () => { },
    simulatorTeamName: '',
    setSimulatorTeamName: () => { },
    connectToSimulator: async () => false,
    disconnectFromSimulator: () => { },
    isConnected: false
};

const SimulationContext = createContext<SimulationContextType>(defaultContext);

export const useSimulation = () => useContext(SimulationContext);

export const SimulationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [isSimulationMode, setIsSimulationMode] = useState(false);
    const [apiKey, setApiKey] = useState('');
    const [serverUrl, setServerUrl] = useState('http://localhost:3000/api');
    const [simulatorTeamName, setSimulatorTeamName] = useState('');
    const [isConnected, setIsConnected] = useState(false);

    // Load saved settings from localStorage on initialization
    useEffect(() => {
        const savedApiKey = localStorage.getItem('simulator_api_key');
        const savedServerUrl = localStorage.getItem('simulator_server_url');
        const savedTeamName = localStorage.getItem('simulator_team_name');
        const simulationModeEnabled = localStorage.getItem('simulation_mode_enabled') === 'true';

        if (savedApiKey) setApiKey(savedApiKey);
        if (savedServerUrl) setServerUrl(savedServerUrl);
        if (savedTeamName) setSimulatorTeamName(savedTeamName);
        if (simulationModeEnabled) setIsSimulationMode(true);

        // Auto-connect if we have saved credentials and simulation mode is enabled
        if (savedApiKey && savedServerUrl && simulationModeEnabled) {
            connectToSimulator(savedApiKey, savedServerUrl);
        }
    }, []);

    const toggleSimulationMode = () => {
        const newMode = !isSimulationMode;
        setIsSimulationMode(newMode);
        localStorage.setItem('simulation_mode_enabled', newMode.toString());

        if (newMode) {
            tradingSimulatorService.enableSimulationMode();
        } else {
            tradingSimulatorService.disableSimulationMode();
        }
    };

    const connectToSimulator = async (key = apiKey, url = serverUrl) => {
        try {
            // Initialize the simulator service
            tradingSimulatorService.init(url, key);

            // Test connection by getting balances
            await tradingSimulatorService.getBalances();

            // If no error thrown, connection is successful
            setIsConnected(true);
            setIsSimulationMode(true);

            // Save settings to localStorage
            localStorage.setItem('simulator_api_key', key);
            localStorage.setItem('simulator_server_url', url);
            localStorage.setItem('simulation_mode_enabled', 'true');

            return true;
        } catch (error) {
            console.error('Failed to connect to trading simulator:', error);
            setIsConnected(false);
            return false;
        }
    };

    const disconnectFromSimulator = () => {
        tradingSimulatorService.disableSimulationMode();
        setIsConnected(false);
        setIsSimulationMode(false);
        localStorage.setItem('simulation_mode_enabled', 'false');
    };

    return (
        <SimulationContext.Provider
            value={{
                isSimulationMode,
                toggleSimulationMode,
                apiKey,
                setApiKey,
                serverUrl,
                setServerUrl,
                simulatorTeamName,
                setSimulatorTeamName,
                connectToSimulator: () => connectToSimulator(),
                disconnectFromSimulator,
                isConnected
            }}
        >
            {children}
        </SimulationContext.Provider>
    );
}; 