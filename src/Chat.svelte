<script>
	import { toDate, formatDistanceToNow } from "date-fns";
	import { tr } from 'date-fns/locale'

	// Variables
	export let uid;
	export let groups;
	export let focusedGroupId;

	// Functions
	export let PromptPhoneNumber;
	export let GetUIDOfPhone;
	export let AddToGroup;

	const groupsCollection = db.collection("Groups");

	let messageToSend = "";

	$: {
		// Scroll to bottom automatically
		if (focusedGroupId) {
			// setTimeout is to wait for mount
			setTimeout(() => {
				const element = document.getElementById("messages");
				element.scrollIntoView(false);
			}, 0);
		}
	}

	async function PromptToAddToGroup(groupId) {
		const phone = await PromptPhoneNumber();
		const uidToAdd = await GetUIDOfPhone(phone);

		// Given UID does not exists...
		if (!uidToAdd) {
			return alert("Kullanıcı henüz bChat hesabı oluşturmamış.");
		}

		const usersOfGroup = Object.keys(groups[groupId].users);
		const alreadyInGroup = usersOfGroup.includes(uidToAdd);

		if (alreadyInGroup) {
			return alert("Kullanıcı zaten grupta.");
		}

		AddToGroup(uidToAdd, groupId);
	}

	async function LeaveGroup(groupId) {
		if (!confirm("Emin misiniz?")) { return }

		const usersCollection = db.collection("Users");
		const user = await usersCollection.doc(uid).get();
		const data = user.data();

		if (Object.keys(groups[groupId].users).length <= 2) {
			// Delete Group
			groupsCollection.doc(groupId).delete()
				.then(() => { console.log("Group Deleted Successfully!") })
				.catch(err => { console.error("Group Could Not Be Deleted!", error) });

			// Remove Group From It's Users
			const usersToUpdate = Object.keys(groups[groupId].users);

			for (const userId of usersToUpdate) {
				const ref = usersCollection.doc(userId);
				ref.get().then(doc => {
					const data = doc.data();
					data.groups = data.groups.filter(x => x != groupId);
					ref.set(data);
				});
			}
		}

		usersCollection.doc(uid).set(data);

		// Go back home
		focusedGroupId = "";
	}

	// Convert Date.now() to Turkish relative time (... ago)
	function RelativeFormat(timestamp) {
		const date = toDate(parseInt(timestamp));
		const dist = formatDistanceToNow(date, { locale: tr }) + " önce";
		const firstWord = dist.substr(0, dist.indexOf(" "));

		if (dist == "bir dakikadan az önce") {
			return "şimdi";
		}

		if (firstWord == "yaklaşık") {
			return dist.substr(dist.indexOf(" ") + 1);
		} else {
			return dist;
		}
	}

	function SendMessage(groupId, message) {
		if (!messageToSend) { return }

		const ref = groupsCollection.doc(groupId);

		// Strucuture of the generated data
		// data.messages = { timestamp: { uid, message }, ... }

		// Generate data
		const sentAt = Date.now();
		const data = { messages: {} };
		data["messages"][sentAt] = {};
		data["messages"][sentAt]["sentBy"] = uid;
		data["messages"][sentAt]["text"] = message;

		// Send the generated data to the firebase
		ref.set(data, { merge: true });

		messageToSend = "";
	}
</script>

<header>
	<a href='#'>Geri</a>
	<button on:click={() => { PromptToAddToGroup(focusedGroupId) }}>Kişi Ekle</button>
	<button on:click={() => { LeaveGroup(focusedGroupId) }}>Ayrıl</button>
</header>

<main>
	<div id="messages">
		{#each Object.entries(groups[focusedGroupId].messages) as [sentAt, message]}
			<p class="message" class:sent={message.sentBy == uid}>
				{#if message.sentBy != uid}
					<span class="sender">{groups[focusedGroupId]["users"][message.sentBy]}</span>
				{/if}
				<span class="text">{message.text}</span>
				<span class="timespan">{RelativeFormat(sentAt)}</span>
			</p>
		{/each}
	</div>

	<div id="sendMessage">
		<input label="SendMessage" type="text" bind:value={messageToSend} placeholder="Mesaj" />
		<button on:click={() => SendMessage(focusedGroupId, messageToSend)}>G</button>
	</div>
</main>

<style>
	header {
		display: flex;
		align-items: center;
		justify-content: space-around;
	}
	header * {
		background: none;
		color: #fff;
		padding: 10px;
		font-size: 1em;
		cursor: pointer;
		opacity: .75;
	}
	header *:hover {
		opacity: 1;
	}
	
	main {
		height: calc(100vh - 170px);
	}

	#messages {
		max-width: 800px;
		display: flex;
		flex-direction: column;
		margin: 10px;

		position: relative;
		left: 50%;
		transform: translateX(-50%);
	}
	.message {
		max-width: 80%;
		min-width: 200px;
		display: inline-flex;
		flex-direction: column;
		padding: 12px 18px;
		margin: 3px 0;
	}
	.message:not(.sent) {
		border-radius: 0 10px 10px 10px;
		align-self: flex-start;
		box-shadow: 0 0 4px #aaa;
	}
	.message.sent {
		border-radius: 10px 0 10px 10px;
		align-self: flex-end;
		background: var(--primary-color);
		color: white;
	}

	.message .sender {
		opacity: .5;
	}
	.message .text {
		padding: 5px 0;
	}
	.message .timespan {
		align-self: flex-end;
		opacity: .3;
	}

	#sendMessage {
		height: 50px;
		display: grid;
		grid-template-columns: 1fr 50px;
		gap: 10px;
		
		position: absolute;
		bottom: 10px;
		right: 10px;
		left: 10px;
	}
	#sendMessage input {
		border: 1px solid #ddd;
		padding: 0 15px;
	}
	#sendMessage button {
		border-radius: 100%;
		background-color: var(--primary-color);
		color: white;
		cursor: pointer;
	}
</style>
