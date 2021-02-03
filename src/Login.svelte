<script>
	import { onMount } from 'svelte';

	export let uid;
	export let auth;

	let phoneInput = "";
	let codeInput = "";
	let phoneSent = false;
	let verificationNeeded = false;

	onMount(() => {
		window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier('signIn', {
			'size': 'invisible',
			'callback': response => { console.log("Recaptcha Verifier Response: ", response) }
		});
	});

	function ConfirmSMS() {
		const code = codeInput.split(" ").join("");

		if (window.confirmationResult) {
			window.confirmationResult.confirm(code)
				.then(() => { console.log("SMS Confirmed") })
				.catch(err => { console.log(err) })
		} else {
			console.log("No window.confirmationResult! Error in signInWithPhoneNumber()");
		}
	}

	async function SignIn() {
		let result = null;

		// User Sent The Phone Number, Show Loading Screen
		const phoneNumber = "+90" + phoneInput.split(" ").join("");
		phoneSent = true;

		// Server Received The Phone Number, Wait For The SMS Code
		result = await auth.signInWithPhoneNumber(phoneNumber, window.recaptchaVerifier);
		verificationNeeded = true;

		window.confirmationResult = result;
	}
</script>

<main>
	{#if phoneSent && !verificationNeeded}
		Loading...
	{/if}

	{#if verificationNeeded}
		<input type="text" bind:value={codeInput} placeholder="xxx xxx" />
		<button id="verifySms" on:click={ConfirmSMS}>Verify</button>
	{:else}
		<input type="text" bind:value={phoneInput} placeholder="xxx xxx xx xx" />
		<button id="signIn" on:click={SignIn}>Sign In</button>
	{/if}
</main>
