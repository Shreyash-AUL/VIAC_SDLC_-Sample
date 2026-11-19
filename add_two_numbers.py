def add_numbers(first_number, second_number):
	return first_number + second_number


if __name__ == "__main__":
	first_number = int(input("Enter the first number: "))
	second_number = int(input("Enter the second number: "))

	print("Sum:", add_numbers(first_number, second_number))