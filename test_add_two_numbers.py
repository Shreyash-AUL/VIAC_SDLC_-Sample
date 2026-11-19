import unittest

from add_two_numbers import add_numbers


class AddNumbersTests(unittest.TestCase):
    def test_add_numbers(self):
        cases = (
            (2, 5, 7),
            (0, 0, 0),
            (0, 5, 5),
            (-2, -5, -7),
            (-2, 5, 3),
        )

        for first_number, second_number, expected in cases:
            with self.subTest(first_number=first_number, second_number=second_number):
                self.assertEqual(add_numbers(first_number, second_number), expected)


if __name__ == "__main__":
    unittest.main()