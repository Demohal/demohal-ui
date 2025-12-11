module.exports = {
    content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
    theme: {
        extend: {},
        fontSize: {
            base: ['12pt', { lineHeight: '1.4' }],
            sm: ['0.875rem', { lineHeight: '1.25rem' }],
            lg: ['1.125rem', { lineHeight: '1.75rem' }],
        },
    },
    plugins: [
        function ({ addUtilities }) {
            addUtilities({
                '.text-base-semibold': {
                    fontSize: '12pt',
                    lineHeight: '1.4',
                    fontWeight: '600', // semi-bold
                }
            });
        }
    ],
};
