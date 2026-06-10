# Simple lambda
square = lambda x: x ** 2
print(square(5))

# Lambda with map
numbers = [1, 2, 3, 4, 5]
squared = list(map(lambda x: x**2, numbers))
print(squared)