
import { Env } from "../../types";

export class SodaService {
    constructor(private env: Env) { }
    async checkHealth() {
        return { status: "OK", checks: {} };
    }
}
