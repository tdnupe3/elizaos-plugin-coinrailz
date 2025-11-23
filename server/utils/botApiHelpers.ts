import { Response } from 'express';

export interface BotApiError {
  success: false;
  error: string;
  code: string;
  timestamp: number;
}

export function sendBotError(
  res: Response,
  statusCode: number,
  error: string,
  code: string
): void {
  res.status(statusCode).json({
    success: false,
    error,
    code,
    timestamp: Date.now()
  } as BotApiError);
}
