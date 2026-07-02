import { createExtension } from "@cognigy/extension-tools";

import { zohoDeskOAuthConnection } from "./connections/zohoDeskOAuthConnection";
import { listTicketAttachmentsNode, uploadTicketAttachmentNode } from "./nodes/attachments/attachments";
import { createContactNode, getContactNode, listContactsNode, listTicketsByContactNode, updateContactNode } from "./nodes/contacts/contacts";
import { listAgentsNode, listDepartmentsNode, listMailReplyAddressesNode } from "./nodes/discovery/discovery";
import { getResolutionHistoryNode, getTicketResolutionNode, updateTicketResolutionNode } from "./nodes/resolution/resolution";
import { addTagToTicketNode, listTagsInTicketNode, listTicketTagsNode, removeTagFromTicketNode, replaceTicketTagsNode, searchTagsNode } from "./nodes/tags/tags";
import { createTicketNode } from "./nodes/tickets/createTicket";
import { filterTicketsNode, onErrorTicketsByFilter, onFoundTicketByFilter, onNotFoundTicketsByFilter } from "./nodes/tickets/filterTickets";
import { getTicketNode, onErrorTicket, onFoundTicket, onNotFoundTicket } from "./nodes/tickets/getTicket";
import { addTicketCommentNode, listTicketConversationsNode, listTicketThreadsNode } from "./nodes/tickets/context";
import { replyToTicketNode } from "./nodes/tickets/replyToTicket";
import { updateTicketNode } from "./nodes/tickets/updateTicket";

export default createExtension({
	nodes: [
		createTicketNode,

		getTicketNode,
		onFoundTicket,
		onNotFoundTicket,
		onErrorTicket,

		updateTicketNode,

		filterTicketsNode,
		onFoundTicketByFilter,
		onNotFoundTicketsByFilter,
		onErrorTicketsByFilter,

		replyToTicketNode,

		listDepartmentsNode,
		listAgentsNode,
		listMailReplyAddressesNode,

		listTicketThreadsNode,
		listTicketConversationsNode,
		addTicketCommentNode,

		listTicketAttachmentsNode,
		uploadTicketAttachmentNode,

		searchTagsNode,
		listTicketTagsNode,
		listTagsInTicketNode,
		addTagToTicketNode,
		removeTagFromTicketNode,
		replaceTicketTagsNode,

		getContactNode,
		listContactsNode,
		createContactNode,
		updateContactNode,
		listTicketsByContactNode,

		getTicketResolutionNode,
		getResolutionHistoryNode,
		updateTicketResolutionNode
	],

	connections: [
		zohoDeskOAuthConnection
	],

	options: {
		label: "Zoho Desk"
	}
});
