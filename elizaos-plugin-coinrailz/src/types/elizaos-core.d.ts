declare module '@elizaos/core' {
  export interface Memory {
    userId: string;
    agentId: string;
    roomId: string;
    content: {
      text?: string;
      action?: string;
      data?: any;
      [key: string]: any;
    };
    [key: string]: any;
  }

  export interface State {
    [key: string]: any;
  }

  export interface IAgentRuntime {
    messageManager: {
      createMemory(memory: Memory): Promise<void>;
    };
    processAction(opts: { action: string; content: any }): Promise<any>;
    [key: string]: any;
  }

  export interface Action {
    name: string;
    similes?: string[];
    description: string;
    examples?: Array<Array<{ user: string; content: { text: string; action?: string; content?: any } }>>;
    validate?: (runtime: IAgentRuntime, message: Memory) => Promise<boolean>;
    handler?: (runtime: IAgentRuntime, message: Memory, state?: State) => Promise<boolean>;
    [key: string]: any;
  }

  export interface Provider {
    get: (runtime: IAgentRuntime, message: Memory, state?: State) => Promise<string>;
    [key: string]: any;
  }

  export interface Plugin {
    name: string;
    description: string;
    actions?: Action[];
    evaluators?: any[];
    providers?: Provider[];
    services?: any[];
    [key: string]: any;
  }

  export function elizaLogger(...args: any[]): void;
  export class AgentRuntime {
    constructor(opts: { plugins?: Plugin[]; env?: Record<string, string>; [key: string]: any });
    [key: string]: any;
  }
}
