import { createExtension } from "@cognigy/extension-tools";

import { sharePointClientCredentialsConnection } from "./connections/sharePointClientCredentialsConnection";
import { sharePointKnowledgeConnector } from "./knowledge-connectors/sharePointKnowledgeConnector";

export default createExtension({
	nodes: [],

	knowledge: [
		sharePointKnowledgeConnector
	],

	connections: [
		sharePointClientCredentialsConnection
	],

	options: {
		label: "SharePoint Knowledge"
	}
});
