import { render, screen } from '@testing-library/react';
import App from './App';

test('renders PETTY SYNC login title', () => {
  render(<App />);
  expect(screen.getByText('PETTY SYNC')).toBeInTheDocument();
});
