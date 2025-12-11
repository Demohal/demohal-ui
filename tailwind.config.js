module.exports = {
    content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
    theme: {
        extend: {},
        fontSize: {
            base: ['12pt', { lineHeight: '1.2' }],
            // Optional: keep other sizes if you use them
            sm: ['0.875rem', { lineHeight: '1.25rem' }],
            lg: ['1.125rem', { lineHeight: '1.75rem' }],
            // ...
        },
    },
    plugins: [],
};
