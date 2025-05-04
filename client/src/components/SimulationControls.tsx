import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useSimulation } from "@/contexts/SimulationContext";
import { useToast } from "@/hooks/use-toast";
import { Beaker, Loader2 } from "lucide-react";
import { Badge } from '@/components/ui/badge';
import { tradingSimulatorService } from '@/services/tradingSimulator';

export function SimulationControls() {
    const { toast } = useToast();
    const {
        isSimulationMode,
        apiKey,
        setApiKey,
        serverUrl,
        setServerUrl,
        simulatorTeamName,
        setSimulatorTeamName,
        connectToSimulator,
        disconnectFromSimulator,
        isConnected
    } = useSimulation();

    const [tempApiKey, setTempApiKey] = useState(apiKey);
    const [tempServerUrl, setTempServerUrl] = useState(serverUrl);
    const [tempTeamName, setTempTeamName] = useState(simulatorTeamName);
    const [isConnecting, setIsConnecting] = useState(false);
    const [showSettings, setShowSettings] = useState(false);

    const handleConnect = async () => {
        setIsConnecting(true);
        try {
            // Save values to context
            setApiKey(tempApiKey);
            setServerUrl(tempServerUrl);
            setSimulatorTeamName(tempTeamName);

            // Attempt connection
            const success = await connectToSimulator();

            if (success) {
                toast({
                    title: "Connected to Simulator",
                    description: `Successfully connected to the trading simulator as ${tempTeamName || 'your team'}`,
                });

                // Get initial balances to verify connection
                const balances = await tradingSimulatorService.getBalances();
                console.log('Initial simulator balances:', balances);

                // Hide settings after successful connection
                setShowSettings(false);
            } else {
                toast({
                    variant: "destructive",
                    title: "Connection Failed",
                    description: "Unable to connect to the trading simulator. Please check your API key and server URL.",
                });
            }
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Connection Error",
                description: String(error),
            });
        } finally {
            setIsConnecting(false);
        }
    };

    const handleDisconnect = () => {
        disconnectFromSimulator();
        toast({
            title: "Disconnected",
            description: "Successfully disconnected from the trading simulator",
        });
    };

    const toggleSettings = () => {
        setShowSettings(!showSettings);
    };

    return (
        <Card className="w-full">
            <CardHeader>
                <div className="flex justify-between items-center">
                    <CardTitle className="flex items-center gap-2">
                        <Beaker className="h-5 w-5" />
                        Trading Simulator
                        {isConnected && (
                            <Badge variant="outline" className="ml-2 bg-green-500 text-white">
                                Connected
                            </Badge>
                        )}
                    </CardTitle>
                    <div className="flex items-center space-x-2">
                        <Switch
                            id="simulation-mode"
                            checked={isSimulationMode}
                            disabled={!isConnected && isSimulationMode}
                            onCheckedChange={isConnected ? () => {
                                if (isSimulationMode) {
                                    handleDisconnect();
                                } else {
                                    handleConnect();
                                }
                            } : undefined}
                        />
                        <Label htmlFor="simulation-mode">
                            {isSimulationMode ? "Simulation Mode" : "Live Mode"}
                        </Label>
                    </div>
                </div>
                <CardDescription>
                    Test your AI trading strategies in a risk-free environment using the multi-chain trading simulator
                </CardDescription>
            </CardHeader>

            <CardContent>
                {!isConnected && (
                    <div className="flex justify-end">
                        <Button variant="outline" onClick={toggleSettings} size="sm">
                            {showSettings ? "Hide Settings" : "Connect to Simulator"}
                        </Button>
                    </div>
                )}

                {showSettings && !isConnected && (
                    <div className="mt-4 space-y-4 p-4 border rounded-md">
                        <div className="space-y-2">
                            <Label htmlFor="server-url">Simulator Server URL</Label>
                            <Input
                                id="server-url"
                                value={tempServerUrl}
                                onChange={(e) => setTempServerUrl(e.target.value)}
                                placeholder="http://localhost:3000/api"
                            />
                            <p className="text-xs text-muted-foreground">
                                The URL of the trading simulator server
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="api-key">API Key</Label>
                            <Input
                                id="api-key"
                                type="password"
                                value={tempApiKey}
                                onChange={(e) => setTempApiKey(e.target.value)}
                                placeholder="Your simulator API key"
                            />
                            <p className="text-xs text-muted-foreground">
                                API key for authenticating with the trading simulator
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="team-name">Team Name (Optional)</Label>
                            <Input
                                id="team-name"
                                value={tempTeamName}
                                onChange={(e) => setTempTeamName(e.target.value)}
                                placeholder="Your team name"
                            />
                        </div>

                        <div className="flex justify-end space-x-2 mt-4">
                            <Button variant="outline" onClick={() => setShowSettings(false)}>
                                Cancel
                            </Button>
                            <Button onClick={handleConnect} disabled={isConnecting || !tempApiKey || !tempServerUrl}>
                                {isConnecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Connect
                            </Button>
                        </div>
                    </div>
                )}

                {isConnected && (
                    <div className="p-4 border rounded-md">
                        <div className="space-y-2 mb-4">
                            <div className="flex justify-between">
                                <span className="text-sm font-medium">Status:</span>
                                <span className="text-sm text-green-600">Connected</span>
                            </div>
                            {simulatorTeamName && (
                                <div className="flex justify-between">
                                    <span className="text-sm font-medium">Team:</span>
                                    <span className="text-sm">{simulatorTeamName}</span>
                                </div>
                            )}
                            <div className="flex justify-between">
                                <span className="text-sm font-medium">Server:</span>
                                <span className="text-sm truncate max-w-[300px]">{serverUrl}</span>
                            </div>
                        </div>

                        <div className="flex justify-end">
                            <Button variant="outline" onClick={handleDisconnect} size="sm" className="text-red-500">
                                Disconnect
                            </Button>
                        </div>
                    </div>
                )}
            </CardContent>

            {isConnected && (
                <CardFooter className="flex justify-between border-t pt-4">
                    <p className="text-sm text-muted-foreground">
                        AI strategies will use simulated balances and execute trades in the simulator environment
                    </p>
                </CardFooter>
            )}
        </Card>
    );
} 