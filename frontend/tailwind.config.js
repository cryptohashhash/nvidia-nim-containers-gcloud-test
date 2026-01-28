/** @type {import('tailwindcss').Config} */
export default {
      content: [
            "./index.html",
            "./src/**/*.{js,ts,jsx,tsx}",
      ],
      theme: {
            extend: {
                  colors: {
                        'nvidia-green': '#76b900',
                        'nvidia-dark': '#1a1a1a',
                  },
            },
      },
      plugins: [],
}
