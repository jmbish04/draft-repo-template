// client.ts
import {
    JulesClientOptions,
    AutomationMode,
    CreateSessionRequest,
    ListActivitiesResponse,
    ListSessionsResponse,
    ListSourcesResponse,
    SendMessageRequest,
    Session,
    Source,
    Activity,
    JulesError
} from './types';



export class JulesClient {
    private apiKey: string;
    private baseUrl: string;

    constructor(options: JulesClientOptions) {
        this.apiKey = options.apiKey;
        this.baseUrl = (options.baseUrl || 'https://jules.googleapis.com/v1alpha').replace(/\/$/, '');
    }

    /**
     * Internal helper to handle fetch requests
     */
    private async request<T>(
        endpoint: string,
        method: 'GET' | 'POST' | 'DELETE' = 'GET',
        body?: any,
        queryParams?: Record<string, string | number>
    ): Promise<T> {
        const url = new URL(`${this.baseUrl}${endpoint}`);

        if (queryParams) {
            Object.entries(queryParams).forEach(([key, value]) => {
                if (value !== undefined && value !== null) {
                    url.searchParams.append(key, String(value));
                }
            });
        }

        const headers: HeadersInit = {
            'x-goog-api-key': this.apiKey,
            'Content-Type': 'application/json',
        };

        const config: RequestInit = {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined,
        };

        const response = await fetch(url.toString(), config);

        if (!response.ok) {
            let errorMessage = `Jules API Error: ${response.status} ${response.statusText}`;
            try {
                const errorData = await response.json() as JulesError;
                if (errorData.error?.message) {
                    errorMessage = `Jules API Error: ${errorData.error.message}`;
                }
            } catch (e) {
                // failed to parse error json, stick to status text
            }
            throw new Error(errorMessage);
        }

        // Handle empty responses (like approvePlan or sendMessage)
        const text = await response.text();
        return text ? JSON.parse(text) : {} as T;
    }

    // ==========================================
    // Sources
    // ==========================================

    /**
     * Lists all sources (repositories) connected to your account.
     */
    async listSources(params?: { pageSize?: number; pageToken?: string; filter?: string }): Promise<ListSourcesResponse> {
        return this.request<ListSourcesResponse>('/sources', 'GET', undefined, params);
    }

    /**
     * Retrieves a single source by full resource name (e.g. sources/github-myorg-repo) or simple ID
     */
    async getSource(sourceNameOrId: string): Promise<Source> {
        const name = sourceNameOrId.startsWith('sources/') ? sourceNameOrId : `sources/${sourceNameOrId}`;
        // The endpoint is /sources/{sourceId}, so we strip 'sources/' if present for the URL path
        const id = name.replace('sources/', '');
        return this.request<Source>(`/sources/${id}`);
    }

    // ==========================================
    // Sessions
    // ==========================================

    /**
     * Creates a new session to start a coding task.
     */
    async createSession(request: CreateSessionRequest): Promise<Session> {
        return this.request<Session>('/sessions', 'POST', request);
    }

    /**
     * Lists all sessions.
     */
    async listSessions(params?: { pageSize?: number; pageToken?: string }): Promise<ListSessionsResponse> {
        return this.request<ListSessionsResponse>('/sessions', 'GET', undefined, params);
    }

    /**
     * Retrieves a single session by ID.
     */
    async getSession(sessionId: string): Promise<Session> {
        return this.request<Session>(`/sessions/${sessionId}`);
    }

    /**
     * Deletes a session.
     */
    async deleteSession(sessionId: string): Promise<void> {
        return this.request<void>(`/sessions/${sessionId}`, 'DELETE');
    }

    /**
     * Sends a message to the agent for feedback or instruction.
     */
    async sendMessage(sessionId: string, message: string): Promise<void> {
        const payload: SendMessageRequest = { prompt: message };
        return this.request<void>(`/sessions/${sessionId}:sendMessage`, 'POST', payload);
    }

    /**
     * Approves a pending plan. Only required if requirePlanApproval was true.
     */
    async approvePlan(sessionId: string): Promise<void> {
        return this.request<void>(`/sessions/${sessionId}:approvePlan`, 'POST', {});
    }

    // ==========================================
    // Activities
    // ==========================================

    /**
     * Lists activities for a specific session.
     */
    async listActivities(sessionId: string, params?: { pageSize?: number; pageToken?: string }): Promise<ListActivitiesResponse> {
        return this.request<ListActivitiesResponse>(`/sessions/${sessionId}/activities`, 'GET', undefined, params);
    }

    /**
     * Retrieves a specific activity.
     */
    async getActivity(sessionId: string, activityId: string): Promise<Activity> {
        return this.request<Activity>(`/sessions/${sessionId}/activities/${activityId}`);
    }
}
