import theme from './theme';

test('theme tokens are present', () => {
  expect(theme.palette.primary.main).toBeTruthy();
  expect(theme.shape.borderRadius).toBeGreaterThan(10);
});
