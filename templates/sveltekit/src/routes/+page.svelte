<div class="container">
	<h1>Welcome to SvelteKit</h1>
	<p>Visit <a href="https://svelte.dev/docs/kit">svelte.dev/docs/kit</a> to read the documentation</p>

	<div class="magnetic-demo">
		<motion-magnetic duration={1.2} strength={0.8}>
			<button class="magnetic-button">
				Hover me! I'm magnetic
			</button>
		</motion-magnetic>

		<motion-magnetic duration={0.8} ease="power2.out" strength={1}>
			<div class="magnetic-card">
				<h3>Magnetic Card</h3>
				<p>This card follows your cursor</p>
			</div>
		</motion-magnetic>
	</div>
</div>

<style>
	.container {
		padding: 2rem;
		max-width: 800px;
		margin: 0 auto;
	}

	.magnetic-demo {
		margin-top: 3rem;
		display: flex;
		flex-direction: column;
		gap: 2rem;
		align-items: center;
	}

	.magnetic-button {
		padding: 1rem 2rem;
		font-size: 1rem;
		font-weight: 600;
		border: 2px solid #ff3e00;
		background: #3f5c6f;
		color: white;
		border-radius: 8px;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.magnetic-button:hover {
		background: #ff3e00;
	}

	.magnetic-card {
		padding: 2rem;
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		border-radius: 12px;
		color: white;
		box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
		text-align: center;
	}

	.magnetic-card h3 {
		margin: 0 0 0.5rem 0;
		font-size: 1.5rem;
	}

	.magnetic-card p {
		margin: 0;
		opacity: 0.9;
	}
</style>
