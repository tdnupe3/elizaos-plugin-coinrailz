
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Bot, Plus, Send, Activity, Shield, TrendingUp, Wallet } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AIAgent {
  id: string;
  name: string;
  type: 'personal_assistant' | 'trading_bot' | 'compliance_monitor' | 'treasury_manager';
  ownerId: string;
  permissions: string[];
  isActive: boolean;
  createdAt: string;
}

interface AITransaction {
  id: string;
  fromAgentId: string;
  toAgentId: string;
  amount: string;
  currency: string;
  purpose: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  metadata: {
    requestedAt: string;
    completedAt?: string;
    riskScore?: number;
  };
}

export function AIAgentManager() {
  const [agents, setAgents] = useState<AIAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showTransferForm, setShowTransferForm] = useState(false);
  const [recentTransactions, setRecentTransactions] = useState<AITransaction[]>([]);
  const { toast } = useToast();

  // Create agent form state
  const [newAgent, setNewAgent] = useState({
    name: '',
    type: 'personal_assistant' as AIAgent['type'],
    permissions: [] as string[]
  });

  // Transfer form state
  const [transfer, setTransfer] = useState({
    fromAgentId: '',
    toAgentId: '',
    amount: '',
    currency: 'USD',
    purpose: ''
  });

  useEffect(() => {
    loadAgents();
  }, []);

  const loadAgents = async () => {
    try {
      const response = await fetch('/api/ai-agents', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setAgents(data);
      }
    } catch (error) {
      console.error('Error loading agents:', error);
      toast({
        title: "Error",
        description: "Failed to load AI agents",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const createAgent = async () => {
    if (!newAgent.name || !newAgent.type || newAgent.permissions.length === 0) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    setCreating(true);
    try {
      const response = await fetch('/api/ai-agents/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(newAgent)
      });

      if (response.ok) {
        const agent = await response.json();
        setAgents([...agents, agent]);
        setNewAgent({ name: '', type: 'personal_assistant', permissions: [] });
        setShowCreateForm(false);
        toast({
          title: "Success",
          description: "AI agent created successfully"
        });
      } else {
        throw new Error('Failed to create agent');
      }
    } catch (error) {
      console.error('Error creating agent:', error);
      toast({
        title: "Error",
        description: "Failed to create AI agent",
        variant: "destructive"
      });
    } finally {
      setCreating(false);
    }
  };

  const initiateTransfer = async () => {
    if (!transfer.fromAgentId || !transfer.toAgentId || !transfer.amount || !transfer.purpose) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    try {
      const response = await fetch('/api/ai-agents/transfer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(transfer)
      });

      if (response.ok) {
        const result = await response.json();
        setTransfer({
          fromAgentId: '',
          toAgentId: '',
          amount: '',
          currency: 'USD',
          purpose: ''
        });
        setShowTransferForm(false);
        toast({
          title: "Success",
          description: "AI agent transfer initiated successfully"
        });
      } else {
        const error = await response.json();
        throw new Error(error.message || 'Transfer failed');
      }
    } catch (error) {
      console.error('Error initiating transfer:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to initiate transfer",
        variant: "destructive"
      });
    }
  };

  const getAgentIcon = (type: AIAgent['type']) => {
    switch (type) {
      case 'trading_bot': return <TrendingUp className="w-5 h-5 text-blue-600" />;
      case 'compliance_monitor': return <Shield className="w-5 h-5 text-red-600" />;
      case 'treasury_manager': return <Wallet className="w-5 h-5 text-green-600" />;
      default: return <Bot className="w-5 h-5 text-purple-600" />;
    }
  };

  const getTypeLabel = (type: AIAgent['type']) => {
    switch (type) {
      case 'personal_assistant': return 'Personal Assistant';
      case 'trading_bot': return 'Trading Bot';
      case 'compliance_monitor': return 'Compliance Monitor';
      case 'treasury_manager': return 'Treasury Manager';
    }
  };

  const availablePermissions = [
    'transfer_funds',
    'read_portfolio',
    'execute_trades',
    'read_transactions',
    'generate_reports',
    'compliance_monitoring'
  ];

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex justify-center">
            <div className="text-neutral-500">Loading AI agents...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Bot className="w-6 h-6 text-blue-600" />
              <CardTitle>AI Agent Management</CardTitle>
            </div>
            <div className="space-x-2">
              <Button 
                onClick={() => setShowCreateForm(!showCreateForm)}
                size="sm"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Agent
              </Button>
              <Button 
                onClick={() => setShowTransferForm(!showTransferForm)}
                variant="outline"
                size="sm"
              >
                <Send className="w-4 h-4 mr-2" />
                Transfer
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Create Agent Form */}
          {showCreateForm && (
            <div className="mb-6 p-4 border rounded-lg bg-gray-50">
              <h3 className="font-semibold mb-4">Create New AI Agent</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="agent-name">Agent Name</Label>
                  <Input
                    id="agent-name"
                    value={newAgent.name}
                    onChange={(e) => setNewAgent({ ...newAgent, name: e.target.value })}
                    placeholder="e.g., Portfolio Manager Bot"
                  />
                </div>
                <div>
                  <Label htmlFor="agent-type">Agent Type</Label>
                  <Select value={newAgent.type} onValueChange={(value: AIAgent['type']) => setNewAgent({ ...newAgent, type: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="personal_assistant">Personal Assistant</SelectItem>
                      <SelectItem value="trading_bot">Trading Bot</SelectItem>
                      <SelectItem value="compliance_monitor">Compliance Monitor</SelectItem>
                      <SelectItem value="treasury_manager">Treasury Manager</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="mt-4">
                <Label>Permissions</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                  {availablePermissions.map(permission => (
                    <div key={permission} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={permission}
                        checked={newAgent.permissions.includes(permission)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setNewAgent({
                              ...newAgent,
                              permissions: [...newAgent.permissions, permission]
                            });
                          } else {
                            setNewAgent({
                              ...newAgent,
                              permissions: newAgent.permissions.filter(p => p !== permission)
                            });
                          }
                        }}
                      />
                      <label htmlFor={permission} className="text-sm">{permission}</label>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex space-x-2 mt-4">
                <Button onClick={createAgent} disabled={creating}>
                  {creating ? 'Creating...' : 'Create Agent'}
                </Button>
                <Button variant="outline" onClick={() => setShowCreateForm(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Transfer Form */}
          {showTransferForm && (
            <div className="mb-6 p-4 border rounded-lg bg-blue-50">
              <h3 className="font-semibold mb-4">AI Agent Transfer</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="from-agent">From Agent</Label>
                  <Select value={transfer.fromAgentId} onValueChange={(value) => setTransfer({ ...transfer, fromAgentId: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select source agent" />
                    </SelectTrigger>
                    <SelectContent>
                      {agents.filter(agent => agent.permissions.includes('transfer_funds')).map(agent => (
                        <SelectItem key={agent.id} value={agent.id}>
                          {agent.name} ({getTypeLabel(agent.type)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="to-agent">To Agent</Label>
                  <Input
                    id="to-agent"
                    value={transfer.toAgentId}
                    onChange={(e) => setTransfer({ ...transfer, toAgentId: e.target.value })}
                    placeholder="Destination agent ID"
                  />
                </div>
                <div>
                  <Label htmlFor="amount">Amount</Label>
                  <Input
                    id="amount"
                    type="number"
                    value={transfer.amount}
                    onChange={(e) => setTransfer({ ...transfer, amount: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <Label htmlFor="currency">Currency</Label>
                  <Select value={transfer.currency} onValueChange={(value) => setTransfer({ ...transfer, currency: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="BTC">BTC</SelectItem>
                      <SelectItem value="ETH">ETH</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="mt-4">
                <Label htmlFor="purpose">Purpose</Label>
                <Textarea
                  id="purpose"
                  value={transfer.purpose}
                  onChange={(e) => setTransfer({ ...transfer, purpose: e.target.value })}
                  placeholder="Describe the purpose of this transfer"
                  rows={2}
                />
              </div>
              <div className="flex space-x-2 mt-4">
                <Button onClick={initiateTransfer}>
                  Initiate Transfer
                </Button>
                <Button variant="outline" onClick={() => setShowTransferForm(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Agent List */}
          <div className="space-y-4">
            {agents.length === 0 ? (
              <div className="text-center py-8 text-neutral-500">
                <Bot className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>No AI agents created yet</p>
                <p className="text-sm">Create your first AI agent to get started</p>
              </div>
            ) : (
              agents.map(agent => (
                <div key={agent.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                  <div className="flex items-center space-x-3">
                    {getAgentIcon(agent.type)}
                    <div>
                      <p className="font-medium">{agent.name}</p>
                      <p className="text-sm text-neutral-500">{getTypeLabel(agent.type)}</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {agent.permissions.map(permission => (
                          <Badge key={permission} variant="secondary" className="text-xs">
                            {permission}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant={agent.isActive ? "default" : "destructive"}>
                      {agent.isActive ? "Active" : "Inactive"}
                    </Badge>
                    <p className="text-xs text-neutral-500 mt-1">
                      ID: {agent.id}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
