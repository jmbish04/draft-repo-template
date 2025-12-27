export async function validateCloudflareToken(
    token: string | undefined | null
): Promise<boolean> {
    if (!token) return false;

    // 1. Try Accounts Endpoint (Account-scoped tokens, service tokens, some API keys)
    try {
        const response = await fetch('https://api.cloudflare.com/client/v4/accounts', {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });

        if (response.ok) return true;
    } catch {
        // Continue to next check
    }

    // 2. Try User Token Verify Endpoint (User-scoped tokens)
    try {
        const response = await fetch(
            'https://api.cloudflare.com/client/v4/user/tokens/verify',
            {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            }
        );

        if (response.ok) {
            const data = (await response.json()) as {
                success: boolean;
                result?: { status: string };
            };

            if (data.success && data.result?.status === 'active') return true;
        }
    } catch {
        // Both failed
    }

    return false;
}