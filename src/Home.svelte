<script>
	export let uid;
	export let auth;

	export let groups;
	export let usersCollection;
	export let groupsCollection;

	export let PromptPhoneNumber;
	export let GetUIDOfPhone;

	function AddToGroup(userId, groupId) {
		const usersDoc = usersCollection.doc(userId);
		const groupDoc = groupsCollection.doc(groupId);

		// Add group to the user
		usersDoc.get().then(doc => {
			const data = doc.data();
			data.groups = [...new Set([...data.groups, groupId])];
			usersDoc.set(data);
		});

		// Add user to the group
		groupDoc.get().then(doc => {
			const data = doc.data();
			data.users = [...new Set([...data.users, userId])];
			groupDoc.set(data);
		});
	}

	async function PromptToCreateGroup() {
		const phone = PromptPhoneNumber();
		const uidToAdd = await GetUIDOfPhone(phone);

		// Given UID does not exists...
		if (!uidToAdd) {
			return alert("Kullanıcı henüz bChat hesabı oluşturmamış.");
		}

		// Given UID belogs to the logged in user...
		if (uidToAdd == uid) {
			return alert("Kendinizle sohbet başlatamazsınız.");
		}

		CreateGroup(uidToAdd);
	}

	function CreateGroup(secondUserId) {
		// Empty Group Data Structure (Only initialize 'users')
		const data = { messages: {}, users: [ uid, secondUserId ] };

		// Add the 'data' to the firebase
		groupsCollection.add(data).then(docRef => {
			// Add yourself and the secondUser to the group
			AddToGroup(uid, docRef.id);
			AddToGroup(secondUserId, docRef.id);
		});
	}
</script>

<main>
	<button on:click={PromptToCreateGroup}>Konuşma Başlat</button>
	<button on:click={() => {auth.signOut()}}>Çıkış Yap</button>

	<hr />

	<div id="groups">
		{#each Object.entries(groups) as [groupId, group]}
			<a href={`#${groupId}`} class="linkToGroup">
				{Object.values(group.users)}
			</a>
		{/each}
	</div>
</main>
