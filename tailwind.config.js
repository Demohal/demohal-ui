module.exports = {
    content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
    theme: {
        extend: {},
        fontSize: {
            base: ['12pt', { lineHeight: '1.4' }],
            xs: ['0.750rem', { lineHeight: '1.00rem' }],
            sm: ['0.875rem', { lineHeight: '1.25rem' }],
            lg: ['1.125rem', { lineHeight: '1.75rem' }],
            xl: ['1.250rem', { lineHeight: '2.00rem' }]
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
