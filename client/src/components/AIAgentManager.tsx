
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bot, Plus, Send, Activity, Shield, TrendingUp, Wallet, MessageSquare, Clock, Zap, Users } from "lucide-react";
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

interface AgentMessage {
  id: string;
  agentId: string;
  content: string;
  type: 'user_message' | 'agent_response' | 'agent_to_agent' | 'system_alert';
  timestamp: string;
  targetAgentId?: string;
}

interface AgentActivity {
  id: string;
  agentId: string;
  action: string;
  description: string;
  timestamp: string;
  status: 'success' | 'failed' | 'in_progress';
  metadata?: any;
}

export function AIAgentManager() {
  const [agents, setAgents] = useState<AIAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showTransferForm, setShowTransferForm] = useState(false);
  const [recentTransactions, setRecentTransactions] = useState<AITransaction[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string>('');
  const [agentMessages, setAgentMessages] = useState<AgentMessage[]>([]);
  const [agentActivities, setAgentActivities] = useState<AgentActivity[]>([]);
  const [userMessage, setUserMessage] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [networkAgents, setNetworkAgents] = useState<AIAgent[]>([]);
  const [showAgentTransactionForm, setShowAgentTransactionForm] = useState(false);
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

  // Agent-to-agent transaction state
  const [agentTransaction, setAgentTransaction] = useState({
    sourceAgentId: '',
    targetAgentId: '',
    amount: '',
    purpose: '',
    autoApprove: false
  });

  useEffect(() => {
    loadAgents();
    loadAgentActivities();
    loadNetworkAgents();
    // Set up real-time updates
    const interval = setInterval(() => {
      loadAgentActivities();
      if (selectedAgent) {
        loadAgentMessages(selectedAgent);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [selectedAgent]);

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

  const loadAgentMessages = async (agentId: string) => {
    try {
      const response = await fetch(`/api/ai-agents/${agentId}/messages`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setAgentMessages(data);
      }
    } catch (error) {
      console.error('Error loading agent messages:', error);
    }
  };

  const loadAgentActivities = async () => {
    try {
      const response = await fetch('/api/ai-agents/activities', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setAgentActivities(data);
      }
    } catch (error) {
      console.error('Error loading agent activities:', error);
    }
  };

  const sendMessageToAgent = async () => {
    if (!userMessage.trim() || !selectedAgent) return;

    try {
      const response = await fetch('/api/ai-agents/message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          agentId: selectedAgent,
          message: userMessage
        })
      });

      if (response.ok) {
        const result = await response.json();
        setUserMessage('');
        loadAgentMessages(selectedAgent);
        toast({
          title: "Message sent",
          description: "Your message has been sent to the agent"
        });
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive"
      });
    }
  };

  const activateAgent = async (agentId: string) => {
    try {
      const response = await fetch(`/api/ai-agents/${agentId}/activate`, {
        method: 'POST',
        credentials: 'include'
      });

      if (response.ok) {
        loadAgents();
        toast({
          title: "Agent activated",
          description: "Agent is now active and ready for tasks"
        });
      }
    } catch (error) {
      console.error('Error activating agent:', error);
      toast({
        title: "Error",
        description: "Failed to activate agent",
        variant: "destructive"
      });
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

  const loadNetworkAgents = async () => {
    try {
      const response = await fetch('/api/ai-agents/network/discover?excludeOwn=true', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setNetworkAgents(data);
      }
    } catch (error) {
      console.error('Error loading network agents:', error);
      toast({
        title: "Error",
        description: "Failed to load network agents",
        variant: "destructive"
      });
    }
  };

  const initiateAgentToAgentTransaction = (targetAgentId: string) => {
    setAgentTransaction({
      ...agentTransaction,
      targetAgentId
    });
    setShowAgentTransactionForm(true);
  };

  const processAgentToAgentTransaction = async () => {
    if (!agentTransaction.sourceAgentId || !agentTransaction.targetAgentId || !agentTransaction.amount || !agentTransaction.purpose) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    try {
      const endpoint = agentTransaction.autoApprove ? '/api/ai-agents/direct-transfer' : '/api/ai-agents/request-transaction';
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(agentTransaction)
      });

      if (response.ok) {
        const result = await response.json();
        setAgentTransaction({
          sourceAgentId: '',
          targetAgentId: '',
          amount: '',
          purpose: '',
          autoApprove: false
        });
        setShowAgentTransactionForm(false);
        toast({
          title: "Success",
          description: result.message
        });
        loadAgentActivities(); // Refresh activities
      } else {
        const error = await response.json();
        throw new Error(error.message || 'Transaction failed');
      }
    } catch (error) {
      console.error('Error processing agent transaction:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to process transaction",
        variant: "destructive"
      });
    }
  };

  const sendAgentToAgentMessage = async (targetAgentId: string) => {
    const sourceAgent = agents.find(agent => agent.permissions.includes('transfer_funds'));
    if (!sourceAgent) {
      toast({
        title: "Error",
        description: "No agents available to send messages",
        variant: "destructive"
      });
      return;
    }

    const message = prompt("Enter message to send to agent:");
    if (!message) return;

    try {
      const response = await fetch('/api/ai-agents/send-agent-message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          fromAgentId: sourceAgent.id,
          toAgentId: targetAgentId,
          message
        })
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Message sent to agent"
        });
      }
    } catch (error) {
      console.error('Error sending agent message:', error);
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive"
      });
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
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="communicate">Communicate</TabsTrigger>
              <TabsTrigger value="activities">Activities</TabsTrigger>
              <TabsTrigger value="create">Create & Transfer</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
          {/* Agent Overview Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {agents.length === 0 ? (
                  <div className="col-span-full text-center py-8 text-neutral-500">
                    <Bot className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p>No AI agents created yet</p>
                    <p className="text-sm">Create your first AI agent to get started</p>
                  </div>
                ) : (
                  agents.map(agent => (
                    <Card key={agent.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => {
                      setSelectedAgent(agent.id);
                      setActiveTab('communicate');
                    }}>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            {getAgentIcon(agent.type)}
                            <div>
                              <h3 className="font-medium">{agent.name}</h3>
                              <p className="text-sm text-neutral-500">{getTypeLabel(agent.type)}</p>
                            </div>
                          </div>
                          <Badge variant={agent.isActive ? "default" : "destructive"}>
                            {agent.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <div className="flex flex-wrap gap-1">
                            {agent.permissions.slice(0, 3).map(permission => (
                              <Badge key={permission} variant="secondary" className="text-xs">
                                {permission}
                              </Badge>
                            ))}
                            {agent.permissions.length > 3 && (
                              <Badge variant="outline" className="text-xs">
                                +{agent.permissions.length - 3} more
                              </Badge>
                            )}
                          </div>
                          <div className="flex justify-between items-center pt-2">
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedAgent(agent.id);
                                setActiveTab('communicate');
                              }}
                            >
                              <MessageSquare className="w-3 h-3 mr-1" />
                              Chat
                            </Button>
                            {!agent.isActive && (
                              <Button 
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  activateAgent(agent.id);
                                }}
                              >
                                <Zap className="w-3 h-3 mr-1" />
                                Activate
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </TabsContent>

            <TabsContent value="communicate" className="space-y-4">
              {/* Agent Communication Interface */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Agent Communication</h3>
                  <Select value={selectedAgent} onValueChange={setSelectedAgent}>
                    <SelectTrigger className="w-64">
                      <SelectValue placeholder="Select an agent to communicate with" />
                    </SelectTrigger>
                    <SelectContent>
                      {agents.filter(agent => agent.isActive).map(agent => (
                        <SelectItem key={agent.id} value={agent.id}>
                          <div className="flex items-center space-x-2">
                            {getAgentIcon(agent.type)}
                            <span>{agent.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedAgent ? (
                  <div className="space-y-4">
                    {/* Message History */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">Conversation History</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ScrollArea className="h-64 w-full border rounded p-4">
                          {agentMessages.length === 0 ? (
                            <div className="text-center text-neutral-500 py-8">
                              <MessageSquare className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                              <p>No messages yet</p>
                              <p className="text-sm">Start a conversation with your agent</p>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {agentMessages.map(message => (
                                <div key={message.id} className={`flex ${message.type === 'user_message' ? 'justify-end' : 'justify-start'}`}>
                                  <div className={`max-w-xs px-3 py-2 rounded-lg ${
                                    message.type === 'user_message' 
                                      ? 'bg-blue-500 text-white' 
                                      : 'bg-gray-100 text-gray-800'
                                  }`}>
                                    <p className="text-sm">{message.content}</p>
                                    <p className="text-xs opacity-70 mt-1">
                                      {new Date(message.timestamp).toLocaleTimeString()}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </ScrollArea>
                      </CardContent>
                    </Card>

                    {/* Message Input */}
                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex space-x-2">
                          <Input
                            value={userMessage}
                            onChange={(e) => setUserMessage(e.target.value)}
                            placeholder="Type your message to the agent..."
                            onKeyPress={(e) => e.key === 'Enter' && sendMessageToAgent()}
                          />
                          <Button onClick={sendMessageToAgent} disabled={!userMessage.trim()}>
                            <Send className="w-4 h-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                ) : (
                  <div className="text-center py-8 text-neutral-500">
                    <Users className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p>Select an agent to start communicating</p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="activities" className="space-y-4">
              {/* Agent Activities */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Activity className="w-5 h-5" />
                    <span>Recent Agent Activities</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-80 w-full">
                    {agentActivities.length === 0 ? (
                      <div className="text-center py-8 text-neutral-500">
                        <Clock className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                        <p>No recent activities</p>
                        <p className="text-sm">Agent activities will appear here</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {agentActivities.map(activity => (
                          <div key={activity.id} className="flex items-start space-x-3 p-3 border rounded-lg">
                            <div className={`w-2 h-2 rounded-full mt-2 ${
                              activity.status === 'success' ? 'bg-green-500' :
                              activity.status === 'failed' ? 'bg-red-500' : 'bg-yellow-500'
                            }`} />
                            <div className="flex-1">
                              <p className="font-medium text-sm">{activity.action}</p>
                              <p className="text-sm text-neutral-600">{activity.description}</p>
                              <div className="flex items-center justify-between mt-1">
                                <Badge variant="outline" className="text-xs">
                                  Agent: {agents.find(a => a.id === activity.agentId)?.name || activity.agentId}
                                </Badge>
                                <span className="text-xs text-neutral-500">
                                  {new Date(activity.timestamp).toLocaleString()}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="create" className="space-y-4">
              {/* Agent Network Discovery */}
              <Card>
                <CardHeader>
                  <CardTitle>Agent Network</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-neutral-600">
                        Discover and interact with other agents in the network
                      </p>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => loadNetworkAgents()}
                      >
                        <Zap className="w-4 h-4 mr-2" />
                        Discover Agents
                      </Button>
                    </div>
                    
                    {networkAgents.length > 0 && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {networkAgents.map(agent => (
                          <div key={agent.id} className="p-3 border rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center space-x-2">
                                {getAgentIcon(agent.type)}
                                <div>
                                  <p className="font-medium text-sm">{agent.name}</p>
                                  <p className="text-xs text-neutral-500">{getTypeLabel(agent.type)}</p>
                                </div>
                              </div>
                              <Badge variant="secondary" className="text-xs">
                                {agent.ownerId === user?.id ? 'Yours' : 'Network'}
                              </Badge>
                            </div>
                            <div className="flex space-x-2">
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => initiateAgentToAgentTransaction(agent.id)}
                                disabled={agent.ownerId === user?.id}
                              >
                                <Send className="w-3 h-3 mr-1" />
                                Request Transfer
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => sendAgentToAgentMessage(agent.id)}
                                disabled={agent.ownerId === user?.id}
                              >
                                <MessageSquare className="w-3 h-3 mr-1" />
                                Message
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Agent-to-Agent Transaction Form */}
              {showAgentTransactionForm && (
                <Card>
                  <CardHeader>
                    <CardTitle>Agent-to-Agent Transaction</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="source-agent">Your Agent</Label>
                          <Select 
                            value={agentTransaction.sourceAgentId} 
                            onValueChange={(value) => setAgentTransaction({ ...agentTransaction, sourceAgentId: value })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select your agent" />
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
                          <Label htmlFor="target-agent">Target Agent</Label>
                          <Input
                            id="target-agent"
                            value={agentTransaction.targetAgentId}
                            onChange={(e) => setAgentTransaction({ ...agentTransaction, targetAgentId: e.target.value })}
                            placeholder="Target agent ID"
                          />
                        </div>
                        <div>
                          <Label htmlFor="amount">Amount</Label>
                          <Input
                            id="amount"
                            type="number"
                            value={agentTransaction.amount}
                            onChange={(e) => setAgentTransaction({ ...agentTransaction, amount: e.target.value })}
                            placeholder="0.00"
                          />
                        </div>
                        <div>
                          <Label htmlFor="purpose">Purpose</Label>
                          <Input
                            id="purpose"
                            value={agentTransaction.purpose}
                            onChange={(e) => setAgentTransaction({ ...agentTransaction, purpose: e.target.value })}
                            placeholder="Transaction purpose"
                          />
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="auto-approve"
                          checked={agentTransaction.autoApprove}
                          onChange={(e) => setAgentTransaction({ ...agentTransaction, autoApprove: e.target.checked })}
                        />
                        <label htmlFor="auto-approve" className="text-sm">Auto-approve (direct transfer)</label>
                      </div>
                      <div className="flex space-x-2">
                        <Button onClick={processAgentToAgentTransaction}>
                          Send Transaction Request
                        </Button>
                        <Button variant="outline" onClick={() => setShowAgentTransactionForm(false)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

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

          {/* Quick Agent Creation */}
              <Card>
                <CardHeader>
                  <CardTitle>Quick Agent Creation</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Button variant="outline" onClick={() => {
                      setNewAgent({
                        name: 'Trading Assistant',
                        type: 'trading_bot',
                        permissions: ['read_portfolio', 'execute_trades', 'read_transactions']
                      });
                      setShowCreateForm(true);
                    }}>
                      <TrendingUp className="w-4 h-4 mr-2" />
                      Create Trading Bot
                    </Button>
                    <Button variant="outline" onClick={() => {
                      setNewAgent({
                        name: 'Personal Assistant',
                        type: 'personal_assistant',
                        permissions: ['transfer_funds', 'read_transactions', 'generate_reports']
                      });
                      setShowCreateForm(true);
                    }}>
                      <Bot className="w-4 h-4 mr-2" />
                      Create Assistant
                    </Button>
                    <Button variant="outline" onClick={() => {
                      setNewAgent({
                        name: 'Compliance Monitor',
                        type: 'compliance_monitor',
                        permissions: ['compliance_monitoring', 'read_transactions', 'generate_reports']
                      });
                      setShowCreateForm(true);
                    }}>
                      <Shield className="w-4 h-4 mr-2" />
                      Create Compliance Bot
                    </Button>
                    <Button variant="outline" onClick={() => {
                      setNewAgent({
                        name: 'Treasury Manager',
                        type: 'treasury_manager',
                        permissions: ['transfer_funds', 'read_portfolio', 'compliance_monitoring']
                      });
                      setShowCreateForm(true);
                    }}>
                      <Wallet className="w-4 h-4 mr-2" />
                      Create Treasury Bot
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
